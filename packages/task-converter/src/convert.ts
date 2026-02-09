/**
 * Pure conversion steps for pandoc-myst pipeline:
 * download Word file, run Pandoc (Word → Markdown), write project files, run MyST build.
 */

import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import type { WorkVersionPayload, FileMetadataSectionItem } from './payload.js';
import { pickWordFile } from './payload.js';

/**
 * Run a command, streaming stdout/stderr to the console with a [label] prefix.
 * Resolves on exit 0, rejects on non-zero exit (with message including stderr if captured).
 */
function runWithLogging(
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
      else reject(new Error(`${label} exited with code ${code}${signal ? ` signal ${signal}` : ''}`));
    });
  });
}

const INDEX_MD = 'index.md';
const DEFAULT_EXPORT_FILENAME = 'document.pdf';
const FALLBACK_DOCX_BASENAME = 'input.docx';
/** CLI for init and build (Curvenote CLI). */
const BUILD_CLI = 'curvenote';

function normalizeExportFilename(name: string): string {
  if (!name) return DEFAULT_EXPORT_FILENAME;
  const base = path.basename(name);
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/**
 * Safe basename for the Word file: use original name from metadata, no path traversal.
 */
function safeDocxBasename(fileEntry: FileMetadataSectionItem & { pathKey?: string }): string {
  const raw = fileEntry.name || (fileEntry.path && path.basename(fileEntry.path)) || '';
  const base = path.basename(raw).trim();
  if (!base) return FALLBACK_DOCX_BASENAME;
  if (base.toLowerCase().endsWith('.docx')) return base;
  if (base.endsWith('.')) return `${base}docx`;
  return `${base}.docx`;
}

/**
 * Download file from signedUrl to tmpFolder/{originalFileName}.
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

/**
 * Run pandoc on the given docx file (absolute path) and write index.md in the same folder.
 * Uses -t gfm (GitHub-Flavored Markdown) so image links have no {width=... height=...} attributes (MyST doesn't support those).
 * Uses --extract-media=. so embedded images are extracted to ./media and markdown uses relative paths (e.g. media/image1.png).
 * We run with cwd: workDir so extraction is in workDir/media/.
 * tmpFolder must be an absolute path; inputDocxBasename is the file name under tmpFolder.
 * Stdout and stderr are streamed to the console with [pandoc] prefix.
 */
export async function runPandoc(tmpFolder: string, inputDocxBasename: string): Promise<void> {
  const workDir = path.resolve(tmpFolder);
  const inputPath = path.join(workDir, inputDocxBasename);
  const outputPath = path.join(workDir, INDEX_MD);
  try {
    await runWithLogging(
      'pandoc',
      [inputPath, '-o', outputPath, '-t', 'gfm', '--extract-media', '.'],
      { cwd: workDir },
      'pandoc',
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not found') || msg.includes('ENOENT')) {
      throw new Error('pandoc not found on PATH; install Pandoc to run Word conversion');
    }
    throw new Error(`Pandoc failed: ${msg}`);
  }
}

/** curvenote.yml project section augmented with work version info */
function buildCurvenoteYaml(workVersion: WorkVersionPayload): string {
  const id = crypto.randomUUID();
  const title = workVersion.title ?? 'Untitled';
  const description = workVersion.description ?? '';
  const authors = Array.isArray(workVersion.authors) ? workVersion.authors : [];
  const authorsYaml = authors.length ? `\nauthors: ${JSON.stringify(authors)}` : '';
  return `version: 1
project:
  id: ${id}
  title: ${JSON.stringify(title)}
  description: ${JSON.stringify(description)}${authorsYaml}
site:
  title: ${JSON.stringify(title)}
`;
}

/**
 * Run curvenote init -y in workDir (non-interactive). Creates default curvenote.yml.
 * Stdout and stderr are streamed to the console with [curvenote init] prefix.
 */
export async function runCurvenoteInit(tmpFolder: string): Promise<void> {
  const workDir = path.resolve(tmpFolder);
  try {
    await runWithLogging(BUILD_CLI, ['init', '-y'], { cwd: workDir }, 'curvenote init');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not found') || msg.includes('ENOENT')) {
      throw new Error(
        `${BUILD_CLI} CLI not found on PATH; install Curvenote CLI`,
      );
    }
    throw new Error(`curvenote init failed: ${msg}`);
  }
}

/**
 * Run curvenote init -y, then patch curvenote.yml with work version metadata (title, authors, description).
 * Then prepend front matter to index.md with exports array for PDF (format: typst so content is only substituted into template, then compiled to PDF).
 */
export async function writeProjectFiles(
  workVersion: WorkVersionPayload,
  tmpFolder: string,
  outputFilename: string = DEFAULT_EXPORT_FILENAME,
): Promise<void> {
  const workDir = path.resolve(tmpFolder);
  await runCurvenoteInit(workDir);
  const ymlPath = path.join(workDir, 'curvenote.yml');
  await fs.writeFile(ymlPath, buildCurvenoteYaml(workVersion), 'utf-8');

  const exportPath = `exports/${outputFilename}`;
  const indexPath = path.join(workDir, INDEX_MD);
  let body = await fs.readFile(indexPath, 'utf-8');
  const frontMatter = `---
title: ${JSON.stringify(workVersion.title ?? 'Untitled')}
exports:
  - format: typst
    template: ../../typst-plain
    output: ${exportPath}
    show_header: true
---

`;
  if (body.startsWith('---')) {
    const end = body.indexOf('\n---', 3);
    if (end !== -1) body = body.slice(end + 4).trim();
  }
  await fs.writeFile(indexPath, frontMatter + body, 'utf-8');
}

/**
 * Run curvenote build index.md --typst in tmpFolder. Expects output at exports/{outputFilename}.
 * Using --typst (with format: typst) avoids duplicate content by only substituting into the template.
 * Stdout and stderr are streamed to the console with [curvenote build] prefix.
 * tmpFolder should be an absolute path.
 */
export async function runMystBuild(
  tmpFolder: string,
  outputFilename: string = DEFAULT_EXPORT_FILENAME,
): Promise<string> {
  const workDir = path.resolve(tmpFolder);
  const indexPath = path.join(workDir, INDEX_MD);
  try {
    await runWithLogging(BUILD_CLI, ['build', indexPath, '--typst'], { cwd: workDir }, 'curvenote build');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not found') || msg.includes('ENOENT')) {
      throw new Error(
        `${BUILD_CLI} CLI not found on PATH; install Curvenote CLI to build PDF`,
      );
    }
    throw new Error(`Build failed: ${msg}`);
  }
  const exportsPdf = `exports/${outputFilename}`;
  const pdfPath = path.join(workDir, exportsPdf);
  try {
    await fs.access(pdfPath);
  } catch {
    throw new Error(`Build did not produce ${exportsPdf}`);
  }
  return pdfPath;
}

/**
 * Full pandoc-myst pipeline: pick Word file, download (preserving original name), pandoc → markdown,
 * write curvenote.yml + index front matter, Curvenote CLI build --pdf. Returns path to built PDF.
 * tmpFolder is resolved to an absolute path for all steps. outputFilename defaults to 'document.pdf'.
 */
export async function runPandocMystPipeline(
  workVersion: WorkVersionPayload,
  tmpFolder: string,
  outputFilename: string = DEFAULT_EXPORT_FILENAME,
): Promise<string> {
  const workDir = path.resolve(tmpFolder);
  const fileEntry = pickWordFile(workVersion);
  const docxBasename = safeDocxBasename(fileEntry);

  await downloadFile(fileEntry, workDir, docxBasename);
  await runPandoc(workDir, docxBasename);

  const name = normalizeExportFilename(outputFilename);
  await writeProjectFiles(workVersion, workDir, name);
  return runMystBuild(workDir, name);
}
