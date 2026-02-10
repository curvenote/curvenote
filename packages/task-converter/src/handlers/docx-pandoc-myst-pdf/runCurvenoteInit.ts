/**
 * Run curvenote init -y in workDir (non-interactive). Creates default curvenote.yml.
 * Stdout and stderr are streamed to the console with [curvenote init] prefix.
 */

import path from 'node:path';
import { runWithLogging } from '../../utils.js';
import { BUILD_CLI } from './constants.js';

export async function runCurvenoteInit(tmpFolder: string): Promise<void> {
  const workDir = path.resolve(tmpFolder);
  try {
    await runWithLogging(BUILD_CLI, ['init', '-y'], { cwd: workDir }, 'curvenote init');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not found') || msg.includes('ENOENT')) {
      throw new Error(`${BUILD_CLI} CLI not found on PATH; install Curvenote CLI`);
    }
    throw new Error(`curvenote init failed: ${msg}`);
  }
}
