/**
 * Materialise a user-selected document figure into a persisted thumbnail.
 *
 * Runs on final upload submission (the `confirm-work` intent). Resolves the selected
 * figure's bytes from the cached document previews, normalises/resizes it with `sharp`,
 * writes it to the work version's storage bucket, and returns the storage key to store
 * in `WorkVersion.thumbnail` (layer 1 of the thumbnail cascade).
 *
 * Returns `null` when no thumbnail could be produced (no selection, missing bytes, or a
 * processing failure) — the caller treats the thumbnail as best-effort and never blocks
 * submission on it.
 */
import { createHash } from 'node:crypto';
import type { Context } from '@curvenote/scms-server';
import { File, KnownBuckets, StorageBackend } from '@curvenote/scms-server';
import { fetchDocumentPreviews } from './fetchPreviews.server';
import { decodeFigureLocator } from './thumbnailSelection';

/** Longest edge of the generated thumbnail, in pixels. */
const THUMBNAIL_MAX_EDGE = 512;
const THUMBNAIL_CONTENT_TYPE = 'image/webp';

function storageKeyForThumbnail(sourcePath: string, hash: string): string {
  const slashIdx = sourcePath.lastIndexOf('/');
  const dir = slashIdx >= 0 ? sourcePath.slice(0, slashIdx) : '';
  const fileName = `${hash}.webp`;
  return dir ? `${dir}/thumbnails/${fileName}` : `thumbnails/${fileName}`;
}

export async function materializeSelectedThumbnail({
  ctx,
  workVersionId,
  cdn,
  locator,
}: {
  ctx: Context;
  workVersionId: string;
  cdn: string;
  locator: string;
}): Promise<string | null> {
  const parts = decodeFigureLocator(locator);
  if (!parts) {
    console.warn('materializeSelectedThumbnail: could not decode locator', locator);
    return null;
  }

  const { previews } = await fetchDocumentPreviews(workVersionId, ctx);
  const preview = previews.find((p) => p.path === parts.sourcePath);
  if (!preview) {
    console.warn('materializeSelectedThumbnail: source preview not found', parts.sourcePath);
    return null;
  }

  const images = (preview.ast.attachments ?? []).filter((att) => att.type === 'image');
  const attachment = images[parts.figureIndex];
  if (!attachment?.data) {
    console.warn('materializeSelectedThumbnail: selected figure has no data', parts);
    return null;
  }

  const sourceBuffer = Buffer.from(attachment.data, 'base64');

  // Defer loading sharp (a native addon) until a thumbnail is actually being produced,
  // keeping the action's server module light on cold start.
  const sharp = (await import('sharp')).default;
  const processed = await sharp(sourceBuffer)
    .resize(THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const hash = createHash('md5').update(processed).digest('hex');
  const key = storageKeyForThumbnail(parts.sourcePath, hash);

  const backend = new StorageBackend(ctx, [KnownBuckets.prv, KnownBuckets.pub]);
  const bucket = backend.knownBucketFromCDN(cdn) ?? KnownBuckets.pub;
  const file = new File(backend, key, bucket);
  await file.writeArrayBuffer(
    processed.buffer.slice(
      processed.byteOffset,
      processed.byteOffset + processed.byteLength,
    ) as ArrayBuffer,
    THUMBNAIL_CONTENT_TYPE,
  );

  return key;
}
