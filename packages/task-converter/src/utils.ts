/**
 * Shared utilities for conversion handlers: subprocess runner, file download, filename helpers.
 */

import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
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
export function safeDocxBasename(fileEntry: FileMetadataSectionItem & { pathKey?: string }): string {
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
  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error(`Failed to download Word file: HTTP ${response.status} ${response.statusText}`);
  }
  const body = response.body;
  if (!body) {
    throw new Error('Download response has no body');
  }
  const writeStream = createWriteStream(dest);
  // Node 18+ fetch body is a Web ReadableStream; fromWeb accepts it
  await pipeline(Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]), writeStream);
  return dest;
}
