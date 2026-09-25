/**
 * HAT conversion handler: myst-curvenote-web
 *
 * Existing MyST package on the work-version CDN (manuscript.md, references.bib,
 * media/…) → Curvenote site build → upload `_build/site` under existing cdn_key
 * → merge `myst` into contains.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { WorkContents } from '@curvenote/scms-core';
import type { FileMetadataSectionItem } from '../../payload.js';
import { downloadFile } from '../../utils.js';
import type { ConversionHandler } from '../types.js';
import { writeSiteProjectFiles } from '../docx-pandoc-myst-web/writeSiteProjectFiles.js';
import { runSiteBuild } from '../docx-pandoc-myst-web/runSiteBuild.js';
import { copyProjectSourcesIntoSite } from '../docx-pandoc-myst-web/copyProjectSourcesIntoSite.js';
import { INDEX_MD } from '../docx-pandoc-myst-pdf/constants.js';

function listContentFiles(
  metadata: {
    files?: Record<string, unknown>;
    foundry?: { files?: Record<string, unknown> };
  } | null,
): Array<FileMetadataSectionItem & { pathKey: string }> {
  const fromFiles = metadata?.files ?? {};
  const fromFoundry = metadata?.foundry?.files ?? {};
  const merged = { ...fromFiles, ...fromFoundry };
  return Object.entries(merged)
    .filter(([, entry]) => entry && typeof entry === 'object')
    .map(([pathKey, entry]) => ({ ...(entry as FileMetadataSectionItem), pathKey }));
}

function pickByName(
  files: Array<FileMetadataSectionItem & { pathKey: string }>,
  name: string,
): (FileMetadataSectionItem & { pathKey: string }) | undefined {
  const lower = name.toLowerCase();
  return files.find(
    (f) =>
      f.name?.toLowerCase() === lower ||
      f.path?.toLowerCase().endsWith(`/${lower}`) ||
      f.path?.toLowerCase().endsWith(lower),
  );
}

export const runMystCurvenoteWeb: ConversionHandler = async (ctx) => {
  const { payload, tmpFolder, client, res } = ctx;
  const workVersion = payload.workVersion;
  const workDir = path.resolve(tmpFolder);

  if (!workVersion.cdn?.trim() || !workVersion.cdn_key?.trim()) {
    throw new Error('Work version is missing cdn/cdn_key; cannot upload web article to storage');
  }

  const files = listContentFiles(workVersion.metadata);
  const manuscript = pickByName(files, 'manuscript.md');
  if (!manuscript) {
    throw new Error('No manuscript.md found in metadata.files or metadata.foundry.files');
  }
  if (!manuscript.signedUrl) {
    throw new Error('manuscript.md has no signedUrl; cannot download for site build');
  }

  await client.jobs.running(res, 'Preparing Curvenote project files...');
  await writeSiteProjectFiles(workVersion, workDir);

  await client.jobs.running(res, 'Downloading MyST manuscript...');
  const manuscriptLocal = await downloadFile(manuscript, workDir, 'manuscript.md');
  // Site build expects index.md as the project root document.
  await fs.copyFile(manuscriptLocal, path.join(workDir, INDEX_MD));

  const bib = pickByName(files, 'references.bib');
  if (bib?.signedUrl) {
    await client.jobs.running(res, 'Downloading references.bib...');
    await downloadFile(bib, workDir, 'references.bib');
  }

  const mediaFiles = files.filter((f) => {
    if (f.name === 'manuscript.md' || f.name === 'references.bib') return false;
    return (
      f.path?.includes('/media/') === true ||
      f.pathKey.includes('/media/') ||
      f.pathKey.includes('/media')
    );
  });
  if (mediaFiles.length > 0) {
    await client.jobs.running(res, `Downloading ${mediaFiles.length} media file(s)...`);
    await fs.mkdir(path.join(workDir, 'media'), { recursive: true });
    for (const media of mediaFiles) {
      if (!media.signedUrl) continue;
      const basename = media.name || path.basename(media.path || media.pathKey);
      await downloadFile(media, path.join(workDir, 'media'), basename);
    }
  }

  await client.jobs.running(res, 'Building web article...');
  const sitePath = await runSiteBuild(workDir);

  await client.jobs.running(res, 'Bundling source materials into site...');
  await copyProjectSourcesIntoSite(workDir, sitePath);

  try {
    await fs.access(path.join(sitePath, 'config.json'));
  } catch {
    throw new Error('Site build did not produce _build/site/config.json');
  }

  await client.jobs.running(res, 'Uploading web article to CDN...');
  const uploadResult = await client.uploads.uploadFolderToCdn({
    cdn: workVersion.cdn,
    cdnKey: workVersion.cdn_key,
    localFolder: sitePath,
  });

  await client.jobs.running(res, 'Updating work contains...');
  await client.works.mergeContainsIntoWorkAndVersion(workVersion.work_id, workVersion.id, [
    WorkContents.MYST,
  ]);

  return `${uploadResult.cdnKey}/config.json`;
};
