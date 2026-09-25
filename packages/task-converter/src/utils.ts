/**
 * Shared utilities for conversion handlers: subprocess runner, file download, filename helpers.
 */

import { createWriteStream, existsSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import type { FileMetadataSectionItem } from './payload.js';

export const DEFAULT_EXPORT_FILENAME = 'document.pdf';
const FALLBACK_DOCX_BASENAME = 'input.docx';

/**
 * Run a command, streaming stdout/stderr to the console with a [label] prefix.
 * Resolves on exit 0, rejects on non-zero exit (with message including stderr if captured).
 */
export function runWithLogging(
  command: string,
  args: string[],
  options: { cwd: string },
  label: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const prefix = (line: string) => (line ? `[${label}] ${line}` : '');
    child.stdout?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) console.log(prefix(line));
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) console.error(prefix(line));
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code, signal) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${label} exited with code ${code}${signal ? ` signal ${signal}` : ''}`));
    });
  });
}

/**
 * Normalize an export filename to a PDF basename (add .pdf if missing).
 */
export function normalizeExportFilename(name: string): string {
  if (!name) return DEFAULT_EXPORT_FILENAME;
  const base = path.basename(name);
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/**
 * Safe basename for the Word file: use original name from metadata, no path traversal.
 */
export function safeDocxBasename(
  fileEntry: FileMetadataSectionItem & { pathKey?: string },
): string {
  const raw = fileEntry.name || (fileEntry.path && path.basename(fileEntry.path)) || '';
  const base = path.basename(raw).trim();
  if (!base) return FALLBACK_DOCX_BASENAME;
  if (base.toLowerCase().endsWith('.docx')) return base;
  if (base.endsWith('.')) return `${base}docx`;
  return `${base}.docx`;
}

/**
 * Download file from signedUrl to tmpFolder/{outputBasename}.
 * tmpFolder should be an absolute path (e.g. path.resolve(tmpFolder)).
 * Throws if signedUrl is missing or download fails.
 *
 * Local Docker: SCMS signs MinIO URLs as http://127.0.0.1:9000/... which is unreachable
 * from the converter container. Rewrite the connect host to host.docker.internal while
 * keeping Host: 127.0.0.1:9000 so the SigV4 signature still validates.
 */
export async function downloadFile(
  fileEntry: FileMetadataSectionItem & { pathKey?: string },
  tmpFolder: string,
  outputBasename: string = safeDocxBasename(fileEntry),
): Promise<string> {
  const signedUrl = fileEntry.signedUrl;
  if (!signedUrl || typeof signedUrl !== 'string') {
    throw new Error(
      'Word file has no signedUrl; cannot download. Add signedUrl to the file entry for conversion.',
    );
  }
  const dest = path.join(tmpFolder, outputBasename);
  try {
    await downloadSignedUrlToFile(signedUrl, dest);
  } catch (err) {
    const cause =
      err instanceof Error && 'cause' in err && err.cause instanceof Error
        ? err.cause.message
        : err instanceof Error
          ? err.message
          : String(err);
    throw new Error(`Failed to download ${outputBasename}: ${cause}`);
  }
  return dest;
}

function shouldRewriteLocalhostForContainer(): boolean {
  if (process.env.TASK_CONVERTER_REWRITE_LOCALHOST === '0') return false;
  if (process.env.TASK_CONVERTER_REWRITE_LOCALHOST === '1') return true;
  try {
    return existsSync('/.dockerenv');
  } catch {
    return false;
  }
}

/**
 * Fetch a signed URL to disk, rewriting localhost → host.docker.internal when in Docker.
 */
export async function downloadSignedUrlToFile(signedUrl: string, dest: string): Promise<void> {
  const parsed = new URL(signedUrl);
  const headers: http.OutgoingHttpHeaders = {};
  let hostname = parsed.hostname;
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');

  if (
    shouldRewriteLocalhostForContainer() &&
    (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')
  ) {
    headers.host = parsed.host;
    hostname = process.env.TASK_CONVERTER_HOST_GATEWAY ?? 'host.docker.internal';
  }

  const lib = parsed.protocol === 'https:' ? https : http;
  const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname,
        port,
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        headers,
      },
      resolve,
    );
    req.on('error', reject);
    req.end();
  });

  if ((response.statusCode ?? 0) < 200 || (response.statusCode ?? 0) >= 300) {
    response.resume();
    throw new Error(`HTTP ${response.statusCode} ${response.statusMessage ?? ''}`.trim());
  }

  await pipeline(response, createWriteStream(dest));
}
