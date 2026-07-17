/**
 * Run `curvenote build` to produce `_build/site` (web article).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { runWithLogging } from '../../utils.js';
import { BUILD_CLI } from '../docx-pandoc-myst-pdf/constants.js';

export async function runSiteBuild(tmpFolder: string): Promise<string> {
  const workDir = path.resolve(tmpFolder);
  try {
    await runWithLogging(BUILD_CLI, ['build'], { cwd: workDir }, 'curvenote build');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not found') || msg.includes('ENOENT')) {
      throw new Error(`${BUILD_CLI} CLI not found on PATH; install Curvenote CLI to build site`);
    }
    throw new Error(`Site build failed: ${msg}`);
  }
  const sitePath = path.join(workDir, '_build', 'site');
  try {
    await fs.access(sitePath);
  } catch {
    throw new Error('Build did not produce _build/site');
  }
  return sitePath;
}
