/**
 * Run curvenote init -y, then patch curvenote.yml with work version metadata (title, authors, description).
 * Then prepend front matter to index.md with exports array for PDF (format: typst so content is only substituted into template, then compiled to PDF).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { WorkVersionPayload } from '../../payload.js';
import { DEFAULT_EXPORT_FILENAME } from '../../utils.js';
import { INDEX_MD } from './constants.js';
import { buildCurvenoteYaml } from './buildCurvenoteYaml.js';
import { runCurvenoteInit } from './runCurvenoteInit.js';

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
