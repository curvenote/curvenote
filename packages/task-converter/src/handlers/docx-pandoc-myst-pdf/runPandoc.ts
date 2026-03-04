/**
 * Run pandoc on the given docx file (absolute path) and write index.md in the same folder.
 * Uses -t gfm (GitHub-Flavored Markdown) so image links have no {width=... height=...} attributes (MyST doesn't support those).
 * Uses --extract-media=. so embedded images are extracted to ./media and markdown uses relative paths (e.g. media/image1.png).
 * We run with cwd: workDir so extraction is in workDir/media/.
 * tmpFolder must be an absolute path; inputDocxBasename is the file name under tmpFolder.
 * Stdout and stderr are streamed to the console with [pandoc] prefix.
 */

import path from 'node:path';
import { runWithLogging } from '../../utils.js';
import { INDEX_MD } from './constants.js';

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
