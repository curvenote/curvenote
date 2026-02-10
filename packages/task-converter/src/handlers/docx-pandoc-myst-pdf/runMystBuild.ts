/**
 * Run curvenote build index.md --typst in tmpFolder. Expects output at exports/{outputFilename}.
 * Using --typst (with format: typst) avoids duplicate content by only substituting into the template.
 * Stdout and stderr are streamed to the console with [curvenote build] prefix.
 * tmpFolder should be an absolute path.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { runWithLogging, DEFAULT_EXPORT_FILENAME } from '../../utils.js';
import { BUILD_CLI, INDEX_MD } from './constants.js';

export async function runMystBuild(
  tmpFolder: string,
  outputFilename: string = DEFAULT_EXPORT_FILENAME,
): Promise<string> {
  const workDir = path.resolve(tmpFolder);
  const indexPath = path.join(workDir, INDEX_MD);
  try {
    await runWithLogging(
      BUILD_CLI,
      ['build', indexPath, '--typst'],
      { cwd: workDir },
      'curvenote build',
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not found') || msg.includes('ENOENT')) {
      throw new Error(`${BUILD_CLI} CLI not found on PATH; install Curvenote CLI to build PDF`);
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
