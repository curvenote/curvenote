/**
 * Copy project sources (excluding `_build`) into `_build/site/source/` so the
 * CDN layout matches CLI submit/push (config.json + content/ + public/ + source/).
 */

import fs from 'node:fs/promises';
import path from 'node:path';

async function copyRecursive(src: string, dest: string): Promise<void> {
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src);
    for (const entry of entries) {
      await copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

export async function copyProjectSourcesIntoSite(
  projectRoot: string,
  sitePath: string,
): Promise<void> {
  const workDir = path.resolve(projectRoot);
  const sourceDest = path.join(path.resolve(sitePath), 'source');
  await fs.mkdir(sourceDest, { recursive: true });

  const entries = await fs.readdir(workDir);
  for (const entry of entries) {
    if (entry === '_build' || entry === 'node_modules' || entry === '.git') continue;
    await copyRecursive(path.join(workDir, entry), path.join(sourceDest, entry));
  }
}
