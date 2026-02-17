/**
 * HAT conversion handler: docx-lowriter-pdf
 *
 * Word → LibreOffice Writer (headless) → PDF.
 * Picks Word from work version, downloads, runs libreoffice --headless --convert-to pdf, returns path to PDF.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { pickWordFile } from '../payload.js';
import {
  downloadFile,
  normalizeExportFilename,
  runWithLogging,
  safeDocxBasename,
} from '../utils.js';
import type { ConversionHandler } from './types.js';
import { uploadPdfAndUpdateWorkVersion } from './pdfUtils.js';

const LIBREOFFICE_CMD = 'soffice';

/**
 * Run LibreOffice headless to convert docx to PDF in workDir.
 * Writes <basename>.pdf into workDir (LibreOffice derives name from input).
 * Returns the path to the generated PDF.
 */
async function runLowriterConvert(workDir: string, docxPath: string): Promise<string> {
  const docxBasename = path.basename(docxPath);
  const pdfBasename = docxBasename.replace(/\.docx$/i, '.pdf');
  try {
    await runWithLogging(
      LIBREOFFICE_CMD,
      ['--headless', '--convert-to', 'pdf', '--outdir', workDir, docxPath],
      { cwd: workDir },
      'libreoffice',
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not found') || msg.includes('ENOENT')) {
      throw new Error(
        `${LIBREOFFICE_CMD} not found on PATH; install LibreOffice (e.g. libreoffice-writer) to run docx-lowriter-pdf conversion`,
      );
    }
    throw new Error(`LibreOffice conversion failed: ${msg}`);
  }
  const pdfPath = path.join(workDir, pdfBasename);
  await fs.access(pdfPath);
  return pdfPath;
}

export const runDocxLowriterPdf: ConversionHandler = async (ctx) => {
  const { payload, tmpFolder, client, res } = ctx;
  const workVersion = payload.workVersion;
  const exportFilename = normalizeExportFilename(payload.filename ?? '');
  const workDir = path.resolve(tmpFolder);
  const fileEntry = pickWordFile(workVersion);
  const docxBasename = safeDocxBasename(fileEntry);

  await client.jobs.running(res, 'Downloading Word file...');
  await downloadFile(fileEntry, workDir, docxBasename);

  await client.jobs.running(res, 'Converting to PDF with LibreOffice...');
  const docxPath = path.join(workDir, docxBasename);
  const pdfPath = await runLowriterConvert(workDir, docxPath);

  const desiredPath = path.join(workDir, exportFilename);
  if (path.resolve(pdfPath) !== path.resolve(desiredPath)) {
    await fs.rename(pdfPath, desiredPath);
  }
  const localPdfPath = path.join(workDir, exportFilename);

  await client.jobs.running(res, 'Uploading PDF and updating work version...');
  return uploadPdfAndUpdateWorkVersion(client, workVersion, localPdfPath, exportFilename);
};
