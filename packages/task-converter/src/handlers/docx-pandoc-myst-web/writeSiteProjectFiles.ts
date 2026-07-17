/**
 * Prepare a MyST project for web site build (no Typst PDF export front matter).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { WorkVersionPayload } from '../../payload.js';
import { INDEX_MD } from '../docx-pandoc-myst-pdf/constants.js';
import { buildCurvenoteYaml } from '../docx-pandoc-myst-pdf/buildCurvenoteYaml.js';
import { runCurvenoteInit } from '../docx-pandoc-myst-pdf/runCurvenoteInit.js';

export async function writeSiteProjectFiles(
  workVersion: WorkVersionPayload,
  tmpFolder: string,
): Promise<void> {
  const workDir = path.resolve(tmpFolder);
  await runCurvenoteInit(workDir);
  const ymlPath = path.join(workDir, 'curvenote.yml');
  await fs.writeFile(ymlPath, buildCurvenoteYaml(workVersion), 'utf-8');

  const indexPath = path.join(workDir, INDEX_MD);
  let body = await fs.readFile(indexPath, 'utf-8');
  const frontMatter = `---
title: ${JSON.stringify(workVersion.title ?? 'Untitled')}
---

`;
  if (body.startsWith('---')) {
    const end = body.indexOf('\n---', 3);
    if (end !== -1) body = body.slice(end + 4).trim();
  }
  await fs.writeFile(indexPath, frontMatter + body, 'utf-8');
}
