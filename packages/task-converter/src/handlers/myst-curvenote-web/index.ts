/**
 * HAT conversion handler: myst-curvenote-web
 *
 * Pull `{cdn_key}/{sourcesPrefix}/` (default `sources/myst`) — manuscript.md,
 * myst.yml, references.bib, media/ — run `curvenote build`, upload `_build/site`
 * to the CDN key root (docx-style), merge `myst` into contains.
 *
 * Expects SCMS to have already filtered `metadata.files` to the package prefix;
 * this handler re-validates paths and rejects anything outside the package.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { WorkContents } from '@curvenote/scms-core';
import {
  isSafeMystWebPackageRelativePath,
  mystWebPackageRelativePath,
  resolveMystWebSourcesPrefix,
} from '@curvenote/common';
import type { FileMetadataSectionItem } from '../../payload.js';
import { downloadFile } from '../../utils.js';
import type { ConversionHandler } from '../types.js';
import { runSiteBuild } from '../docx-pandoc-myst-web/runSiteBuild.js';
import { copyProjectSourcesIntoSite } from '../docx-pandoc-myst-web/copyProjectSourcesIntoSite.js';

function listPackageFiles(
  metadata: { files?: Record<string, unknown> } | null,
  sourcesPrefix: string,
  cdnKey: string,
): Array<{ file: FileMetadataSectionItem & { pathKey: string }; rel: string }> {
  const fromFiles = metadata?.files ?? {};
  const out: Array<{ file: FileMetadataSectionItem & { pathKey: string }; rel: string }> = [];
  for (const [pathKey, entry] of Object.entries(fromFiles)) {
    if (!entry || typeof entry !== 'object') continue;
    const file = { ...(entry as FileMetadataSectionItem), pathKey };
    const full = (file.path || pathKey || '').replace(/^\/+/, '');
    const rel = mystWebPackageRelativePath(full, sourcesPrefix, cdnKey);
    if (!rel || !isSafeMystWebPackageRelativePath(rel)) continue;
    out.push({ file, rel });
  }
  return out;
}

export const runMystCurvenoteWeb: ConversionHandler = async (ctx) => {
  const { payload, tmpFolder, client, res } = ctx;
  const workVersion = payload.workVersion;
  const workDir = path.resolve(tmpFolder);

  if (!workVersion.cdn?.trim() || !workVersion.cdn_key?.trim()) {
    throw new Error('Work version is missing cdn/cdn_key; cannot upload web article to storage');
  }

  const sourcesPrefix = resolveMystWebSourcesPrefix(workVersion.metadata);
  const packageFiles = listPackageFiles(
    workVersion.metadata,
    sourcesPrefix,
    workVersion.cdn_key,
  );

  const hasManuscript = packageFiles.some((p) => p.rel === 'manuscript.md');
  const hasMystYml = packageFiles.some((p) => p.rel === 'myst.yml');
  if (!hasManuscript) {
    throw new Error(`No manuscript.md under ${sourcesPrefix}`);
  }
  if (!hasMystYml) {
    throw new Error(`No myst.yml under ${sourcesPrefix}; Foundry must emit project frontmatter`);
  }

  await client.jobs.running(res, `Downloading MyST package from ${sourcesPrefix}...`);
  for (const { file, rel } of packageFiles) {
    if (!file.signedUrl) {
      throw new Error(`Missing signedUrl for ${rel}`);
    }
    const dest = path.resolve(workDir, rel);
    if (!dest.startsWith(workDir + path.sep) && dest !== workDir) {
      throw new Error(`Refusing to write outside work dir: ${rel}`);
    }
    const destDir = path.dirname(dest);
    await fs.mkdir(destDir, { recursive: true });
    await downloadFile(file, destDir, path.basename(rel));
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
