/**
 * Shared helpers for local MinIO asset seed / profile switch.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptsDir, '../..');
export const assetsRoot = path.join(repoRoot, 'prisma/data/assets');
/** Draft / private CDN mirror → MinIO `prv` bucket. */
export const prvAssetsDir = path.join(assetsRoot, 'prv');
/** Published CDN mirror → MinIO `pub` bucket (matches publish job). */
export const pubAssetsDir = path.join(assetsRoot, 'pub');
/**
 * Site static assets mirror → MinIO `cdn` bucket.
 * Object keys are `static/` + path relative to this dir
 * (e.g. `site/benchmark/logo.svg` → `static/site/benchmark/logo.svg`).
 */
export const staticAssetsDir = path.join(assetsRoot, 'static');

export const DEFAULT_MINIO_ENDPOINT = 'http://127.0.0.1:9000';
export const DEFAULT_MINIO_BUCKET_PRV = 'cdn-private-curvenote-dev-1';
export const DEFAULT_MINIO_BUCKET_PUB = 'cdn-pub-curvenote-dev-1';
export const DEFAULT_MINIO_BUCKET_CDN = 'cdn-curvenote-dev-1';

export async function ensureAssetsLayout(): Promise<void> {
  await fs.mkdir(prvAssetsDir, { recursive: true });
  await fs.mkdir(pubAssetsDir, { recursive: true });
  await fs.mkdir(staticAssetsDir, { recursive: true });
}
