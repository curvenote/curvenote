/**
 * HAT conversion handler: docx-pandoc-myst-pdf
 *
 * Word → Pandoc (→ Markdown) → MyST + Typst → PDF.
 * Picks Word from work version, downloads, runs pandoc, writes curvenote.yml + index.md
 * front matter, then curvenote build --typst. Returns path to the built PDF.
 */

import path from 'node:path';
import { pickWordFile } from '../../payload.js';
import { downloadFile, normalizeExportFilename, safeDocxBasename } from '../../utils.js';
import type { ConversionHandler } from '../types.js';
import { uploadPdfAndUpdateWorkVersion } from '../pdfUtils.js';
import { runPandoc } from './runPandoc.js';
import { writeProjectFiles } from './writeProjectFiles.js';
import { runMystBuild } from './runMystBuild.js';

export { runPandoc } from './runPandoc.js';
export { runCurvenoteInit } from './runCurvenoteInit.js';
export { writeProjectFiles } from './writeProjectFiles.js';
export { runMystBuild } from './runMystBuild.js';
export { buildCurvenoteYaml } from './buildCurvenoteYaml.js';
export { INDEX_MD, BUILD_CLI } from './constants.js';

export const runDocxPandocMystPdf: ConversionHandler = async (ctx) => {
  const { payload, tmpFolder, client, res } = ctx;
  const workVersion = payload.workVersion;
  const exportFilename = normalizeExportFilename(payload.filename ?? '');
  const workDir = path.resolve(tmpFolder);
  const fileEntry = pickWordFile(workVersion);
  const docxBasename = safeDocxBasename(fileEntry);

  await client.jobs.running(res, 'Downloading Word file...');
  await downloadFile(fileEntry, workDir, docxBasename);

  await client.jobs.running(res, 'Converting Word to Markdown (Pandoc)...');
  await runPandoc(workDir, docxBasename);

  await client.jobs.running(res, 'Preparing project files...');
  await writeProjectFiles(workVersion, workDir, exportFilename);

  await client.jobs.running(res, 'Building PDF with Curvenote...');
  const pdfPath = await runMystBuild(workDir, exportFilename);

  await client.jobs.running(res, 'Uploading PDF and updating work version...');
  return uploadPdfAndUpdateWorkVersion(client, workVersion, pdfPath, exportFilename);
};
