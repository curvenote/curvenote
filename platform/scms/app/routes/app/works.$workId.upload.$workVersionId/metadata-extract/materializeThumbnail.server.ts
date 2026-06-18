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
import { File, KnownBuckets, resolveThumbnailBucket, StorageBackend } from '@curvenote/scms-server';
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

/**
 * Build a `sharp` pipeline from a decoded figure, handling formats that sharp's
 * prebuilt (libvips) binary cannot decode directly.
 *
 * sharp natively decodes JPEG/PNG/WebP/GIF/TIFF/SVG/AVIF, but NOT BMP. PDF figures
 * extracted by officeparser (via pdfjs) are emitted as `image/bmp`, so we decode
 * those to raw pixels with `bmp-js` and feed sharp via its raw input.
 */
export async function createSharpPipeline(buffer: Buffer, mimeType: string) {
  const sharp = (await import('sharp')).default;

  if (mimeType === 'image/bmp') {
    const { decode } = await import('bmp-js');
    const decoded = decode(buffer);
    // bmp-js returns pixels as ABGR (4 bytes/pixel); sharp raw input expects RGBA.
    // Note: bmp-js only writes a real alpha byte for 32-bit BMPs — for lower bit
    // depths it leaves alpha as 0, which sharp would treat as fully transparent
    // (producing a blank thumbnail). Force opaque unless the source is 32-bit.
    const { data, width, height, bitPP } = decoded;
    const hasAlpha = bitPP === 32;
    const rgba = Buffer.allocUnsafe(data.length);
    for (let i = 0; i < data.length; i += 4) {
      rgba[i] = data[i + 3]; // R
      rgba[i + 1] = data[i + 2]; // G
      rgba[i + 2] = data[i + 1]; // B
      rgba[i + 3] = hasAlpha ? data[i] : 0xff; // A
    }
    return sharp(rgba, { raw: { width, height, channels: 4 } });
  }

  return sharp(buffer);
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

  // Defer loading sharp (a native addon) and the BMP decoder until a thumbnail is
  // actually being produced, keeping the action's server module light on cold start.
  const pipeline = await createSharpPipeline(sourceBuffer, attachment.mimeType);
  const processed = await pipeline
    .resize(THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const hash = createHash('md5').update(processed).digest('hex');
  const key = storageKeyForThumbnail(parts.sourcePath, hash);

  const backend = new StorageBackend(ctx, [KnownBuckets.prv, KnownBuckets.pub]);
  const bucket = resolveThumbnailBucket(ctx, backend, cdn);
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
