/**
 * HAT conversion handler: myst-curvenote-web
 *
 * Pull `{cdn_key}/{sourcesPrefix}/` (default `sources/myst`) — manuscript.md,
 * myst.yml, references.bib, media/ — run `curvenote build`, upload `_build/site`
 * to the CDN key root (docx-style), merge `myst` into contains.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { WorkContents } from '@curvenote/scms-core';
import type { FileMetadataSectionItem } from '../../payload.js';
import { downloadFile } from '../../utils.js';
import type { ConversionHandler } from '../types.js';
import { runSiteBuild } from '../docx-pandoc-myst-web/runSiteBuild.js';
import { copyProjectSourcesIntoSite } from '../docx-pandoc-myst-web/copyProjectSourcesIntoSite.js';

const DEFAULT_SOURCES_PREFIX = 'sources/myst';

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

function resolveSourcesPrefix(metadata: unknown): string {
  const foundry = (metadata as { foundry?: { publish?: { sourcesPrefix?: string } } } | null)
    ?.foundry;
  const prefix = foundry?.publish?.sourcesPrefix?.trim();
  return prefix && prefix.length > 0 ? prefix.replace(/\/$/, '') : DEFAULT_SOURCES_PREFIX;
}

/** Relative path inside the package (e.g. manuscript.md, media/x.png). */
function packageRelativePath(
  file: FileMetadataSectionItem & { pathKey: string },
  sourcesPrefix: string,
  cdnKey: string,
): string | null {
  const full = (file.path || file.pathKey || '').replace(/^\/+/, '');
  const markers = [`${cdnKey}/${sourcesPrefix}/`, `${sourcesPrefix}/`];
  for (const marker of markers) {
    const idx = full.indexOf(marker);
    if (idx >= 0) return full.slice(idx + marker.length);
  }
  // Fallback: known package filenames at any depth
  const name = file.name || path.basename(full);
  if (name === 'manuscript.md' || name === 'myst.yml' || name === 'references.bib') {
    return name;
  }
  if (full.includes('/media/')) {
    return `media/${name}`;
  }
  return null;
}

export const runMystCurvenoteWeb: ConversionHandler = async (ctx) => {
  const { payload, tmpFolder, client, res } = ctx;
  const workVersion = payload.workVersion;
  const workDir = path.resolve(tmpFolder);

  if (!workVersion.cdn?.trim() || !workVersion.cdn_key?.trim()) {
    throw new Error('Work version is missing cdn/cdn_key; cannot upload web article to storage');
  }

  const sourcesPrefix = resolveSourcesPrefix(workVersion.metadata);
  const files = listContentFiles(workVersion.metadata);
  const packageFiles = files
    .map((f) => {
      const rel = packageRelativePath(f, sourcesPrefix, workVersion.cdn_key!);
      return rel ? { file: f, rel } : null;
    })
    .filter((x): x is { file: FileMetadataSectionItem & { pathKey: string }; rel: string } =>
      Boolean(x),
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
    const destDir = path.join(workDir, path.dirname(rel));
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
