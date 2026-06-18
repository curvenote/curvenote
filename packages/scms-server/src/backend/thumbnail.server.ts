import { ensureTrailingSlash } from '@curvenote/scms-core';
import * as cdnlib from '@curvenote/cdn';
import type { Context } from './context.server.js';
import { File, KnownBuckets, StorageBackend } from './storage/index.js';

/**
 * Minimal work-version shape needed to resolve a thumbnail. Satisfied by the lean
 * selects (`cdnWorkVersionSelect`, `siteWorkWorkVersionSelect`, etc.) — the resolver
 * never needs the `metadata` JSON blob.
 */
export interface ThumbnailSource {
  cdn: string | null;
  cdn_key: string | null;
  thumbnail?: string | null;
}

/**
 * Whether a work version can produce a thumbnail under the cascade. Used by link
 * builders to decide whether to emit a `links.thumbnail` URL. True when the preferred
 * `thumbnail` column is set (even for drafts without a published manifest) or when a
 * published CDN manifest exists.
 */
export function hasResolvableThumbnail(wv: ThumbnailSource): boolean {
  return Boolean(wv.thumbnail && wv.cdn) || Boolean(wv.cdn && wv.cdn_key);
}

function resolveBucket(ctx: Context, backend: StorageBackend, cdn: string): KnownBuckets {
  return (
    backend.knownBucketFromCDN(cdn) ??
    (ctx.privateCdnUrls().has(ensureTrailingSlash(cdn)) ? KnownBuckets.prv : KnownBuckets.pub)
  );
}

/**
 * Resolve a work version's thumbnail bytes using the cascade:
 *   1. `workVersion.thumbnail` (column) — read directly from storage (skips the manifest
 *      `config.json` round-trip).
 *   2. published CDN manifest via `getThumbnailBuffer` (current behaviour).
 *
 * Returns `undefined` when no thumbnail is available. Callers serve the returned buffer
 * as the image response (preserving existing cache headers / private-site handling).
 */
export async function resolveWorkVersionThumbnail(
  ctx: Context,
  wv: ThumbnailSource,
  opts?: { query?: string },
): Promise<ArrayBuffer | undefined> {
  // Layer 1: preferred thumbnail column.
  if (wv.thumbnail && wv.cdn) {
    try {
      const backend = new StorageBackend(ctx, [KnownBuckets.prv, KnownBuckets.pub]);
      const bucket = resolveBucket(ctx, backend, wv.cdn);
      const file = new File(backend, wv.thumbnail, bucket);
      const buffer = await file.download();
      return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
    } catch (err) {
      console.warn('resolveWorkVersionThumbnail: column thumbnail unavailable, falling back', {
        thumbnail: wv.thumbnail,
        err,
      });
    }
  }

  // Layer 2: published CDN manifest.
  if (wv.cdn && wv.cdn_key) {
    const location = await cdnlib.getCdnLocation({ cdn: wv.cdn, key: wv.cdn_key });
    return cdnlib.getThumbnailBuffer({ ...location, query: opts?.query });
  }

  return undefined;
}
