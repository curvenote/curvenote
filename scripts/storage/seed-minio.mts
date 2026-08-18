#!/usr/bin/env tsx
/**
 * Copy prisma/data/assets/ into local MinIO (idempotent).
 * Does not call GCP — only uses the local mirror.
 *
 * - assets/prv/{cdn_key}/ → MinIO private bucket (drafts)
 * - assets/pub/{cdn_key}/ → MinIO public bucket (published works)
 * - assets/static/{path} → MinIO CDN bucket as static/{path} (site logos, etc.)
 *
 * Usage:
 *   bun run storage:seed
 *   bun run storage:seed -- --endpoint=http://127.0.0.1:9000
 */
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_MINIO_BUCKET_CDN,
  DEFAULT_MINIO_BUCKET_PRV,
  DEFAULT_MINIO_BUCKET_PUB,
  DEFAULT_MINIO_ENDPOINT,
  ensureAssetsLayout,
  prvAssetsDir,
  pubAssetsDir,
  staticAssetsDir,
} from './assets.shared.mts';

function parseArgs(argv: string[]) {
  let endpoint = process.env.MINIO_ENDPOINT ?? DEFAULT_MINIO_ENDPOINT;
  let accessKeyId = process.env.MINIO_ACCESS_KEY ?? 'curvenote';
  let secretAccessKey = process.env.MINIO_SECRET_KEY ?? 'curvenote';
  let prvBucket = process.env.MINIO_PRV_BUCKET ?? DEFAULT_MINIO_BUCKET_PRV;
  let pubBucket = process.env.MINIO_PUB_BUCKET ?? DEFAULT_MINIO_BUCKET_PUB;
  let cdnBucket = process.env.MINIO_CDN_BUCKET ?? DEFAULT_MINIO_BUCKET_CDN;
  for (const arg of argv) {
    if (arg.startsWith('--endpoint=')) endpoint = arg.slice('--endpoint='.length);
    if (arg.startsWith('--access-key=')) accessKeyId = arg.slice('--access-key='.length);
    if (arg.startsWith('--secret-key=')) secretAccessKey = arg.slice('--secret-key='.length);
    if (arg.startsWith('--prv-bucket=')) prvBucket = arg.slice('--prv-bucket='.length);
    if (arg.startsWith('--pub-bucket=')) pubBucket = arg.slice('--pub-bucket='.length);
    if (arg.startsWith('--cdn-bucket=')) cdnBucket = arg.slice('--cdn-bucket='.length);
  }
  return { endpoint, accessKeyId, secretAccessKey, prvBucket, pubBucket, cdnBucket };
}

async function* walkFiles(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkFiles(full);
    else if (entry.isFile()) yield full;
  }
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.json':
      return 'application/json';
    case '.html':
      return 'text/html';
    case '.css':
      return 'text/css';
    case '.js':
      return 'application/javascript';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.gif':
      return 'image/gif';
    case '.ico':
      return 'image/x-icon';
    case '.pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

async function seedTree(
  client: S3Client,
  rootDir: string,
  bucket: string,
  label: string,
  options?: { keyPrefix?: string },
): Promise<number> {
  let uploaded = 0;
  const keyPrefix = options?.keyPrefix?.replace(/\/?$/, '/') ?? '';
  for await (const filePath of walkFiles(rootDir)) {
    const base = path.basename(filePath);
    if (base.startsWith('.')) continue;
    const relative = path.relative(rootDir, filePath).split(path.sep).join('/');
    if (!relative || relative.endsWith('/')) continue;
    const key = `${keyPrefix}${relative}`;
    const body = await fs.readFile(filePath);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentTypeFor(filePath),
      }),
    );
    uploaded += 1;
    if (uploaded % 25 === 0) console.log(`  … ${label}: ${uploaded} objects`);
  }
  console.log(`Seeded ${uploaded} object(s) from ${rootDir} → ${bucket}/${keyPrefix}`);
  return uploaded;
}

async function main() {
  const { endpoint, accessKeyId, secretAccessKey, prvBucket, pubBucket, cdnBucket } = parseArgs(
    process.argv.slice(2),
  );
  await ensureAssetsLayout();

  const client = new S3Client({
    region: 'us-east-1',
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  const prvCount = await seedTree(client, prvAssetsDir, prvBucket, 'prv');
  const pubCount = await seedTree(client, pubAssetsDir, pubBucket, 'pub');
  const staticCount = await seedTree(client, staticAssetsDir, cdnBucket, 'static', {
    keyPrefix: 'static/',
  });

  if (prvCount + pubCount + staticCount === 0) {
    console.log(
      'Mirror is empty. Add trees under prisma/data/assets/prv/, pub/, and/or static/ then re-run storage:seed.',
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
