/**
 * HAT conversion handler: docx-pandoc-myst-web
 *
 * Word → Pandoc (→ Markdown) → MyST site build → upload `_build/site` under existing cdn_key
 * (CLI-compatible layout: config.json, content/, public/, source/) → merge `myst` into contains.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { WorkContents } from '@curvenote/scms-core';
import { pickWordFile } from '../../payload.js';
import { downloadFile, safeDocxBasename } from '../../utils.js';
import type { ConversionHandler } from '../types.js';
import { runPandoc } from '../docx-pandoc-myst-pdf/runPandoc.js';
import { writeSiteProjectFiles } from './writeSiteProjectFiles.js';
import { runSiteBuild } from './runSiteBuild.js';
import { copyProjectSourcesIntoSite } from './copyProjectSourcesIntoSite.js';

export { writeSiteProjectFiles } from './writeSiteProjectFiles.js';
export { runSiteBuild } from './runSiteBuild.js';
export { copyProjectSourcesIntoSite } from './copyProjectSourcesIntoSite.js';

export const runDocxPandocMystWeb: ConversionHandler = async (ctx) => {
  const { payload, tmpFolder, client, res } = ctx;
  const workVersion = payload.workVersion;
  const workDir = path.resolve(tmpFolder);
  const fileEntry = pickWordFile(workVersion);
  const docxBasename = safeDocxBasename(fileEntry);

  if (!workVersion.cdn?.trim() || !workVersion.cdn_key?.trim()) {
    throw new Error('Work version is missing cdn/cdn_key; cannot upload MyST site to storage');
  }

  await client.jobs.running(res, 'Downloading Word file...');
  await downloadFile(fileEntry, workDir, docxBasename);

  await client.jobs.running(res, 'Converting Word to Markdown (Pandoc)...');
  await runPandoc(workDir, docxBasename);

  await client.jobs.running(res, 'Preparing MyST project files...');
  await writeSiteProjectFiles(workVersion, workDir);

  await client.jobs.running(res, 'Building MyST site...');
  const sitePath = await runSiteBuild(workDir);

  await client.jobs.running(res, 'Bundling source materials into site...');
  await copyProjectSourcesIntoSite(workDir, sitePath);

  // Ensure config.json exists (CLI upload gate)
  try {
    await fs.access(path.join(sitePath, 'config.json'));
  } catch {
    throw new Error('Site build did not produce _build/site/config.json');
  }

  await client.jobs.running(res, 'Uploading MyST site to CDN...');
  const uploadResult = await client.uploads.uploadFolderToCdn({
    cdn: workVersion.cdn,
    cdnKey: workVersion.cdn_key,
    localFolder: sitePath,
  });

  await client.jobs.running(res, 'Updating work contains (myst)...');
  await client.works.mergeContainsIntoWorkAndVersion(workVersion.work_id, workVersion.id, [
    WorkContents.MYST,
  ]);

  return `${uploadResult.cdnKey}/config.json`;
};
