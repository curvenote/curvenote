import { ensureTrailingSlash } from '@curvenote/scms-core';
import type { Context } from '../context.server.js';
import type { StorageBackend } from './backend.server.js';
import { KnownBuckets } from './constants.server.js';

/**
 * Maps a work-version CDN base URL to the storage bucket that holds its objects.
 *
 * Uses `knownBucketInfoMap` first (local MinIO path-style URLs, etc.), then falls
 * back to `privateCDNSigningInfo` hostnames for legacy private CDN URLs.
 */
export function resolveBucketForCdn(
  ctx: Context,
  backend: StorageBackend,
  cdn: string,
): KnownBuckets {
  return (
    backend.knownBucketFromCDN(cdn) ??
    (ctx.privateCdnUrls().has(ensureTrailingSlash(cdn)) ? KnownBuckets.prv : KnownBuckets.pub)
  );
}
