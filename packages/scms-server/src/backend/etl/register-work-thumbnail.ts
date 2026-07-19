import { normalizeCdnKey } from './register-work-cdn-key.js';

/**
 * Derive the storage key for a work version's thumbnail from the MyST frontmatter
 * `thumbnail` (or `thumbnailOptimized`) posted to the ETL register endpoint.
 *
 * This is an *optimization* for layer 1 of the thumbnail cascade
 * (`resolveWorkVersionThumbnail`): ETL-registered works already resolve via the
 * published CDN manifest (layer 2), so populating `WorkVersion.thumbnail` simply lets
 * the resolver sign the asset directly and skip the `config.json` round-trip.
 *
 * The value must be a key the resolver can sign against `work.cdn` the same way the CDN
 * manifest resolves it. The manifest rewrites a frontmatter `thumbnail` to
 * `${cdn}${cdnKeyPath}/public/${thumbnail}` (see `@curvenote/cdn` `updateUrl` +
 * `withPublicFolderUrl`), so the bucket key — everything after the `cdn` host — is
 * `${cdnKeyPath}/public/${thumbnail}`.
 *
 * Returns `undefined` (leaving the column null; layer 2 still works) when there is no
 * usable relative thumbnail — e.g. missing, non-string, or an absolute URL we cannot
 * sign against our own storage.
 */
export function deriveEtlThumbnailStorageKey(
  cdnKey: string,
  mystMetadata: Record<string, unknown> | undefined,
): string | undefined {
  if (!mystMetadata) return undefined;

  const raw = mystMetadata.thumbnail ?? mystMetadata.thumbnailOptimized;
  if (typeof raw !== 'string') return undefined;
  const thumbnail = raw.trim();
  if (!thumbnail) return undefined;

  // Absolute URLs (already-hosted assets, data URIs) cannot be signed against our bucket.
  if (/^(https?:)?\/\//i.test(thumbnail) || /^data:/i.test(thumbnail)) return undefined;

  const cdnKeyPath = normalizeCdnKey(cdnKey.replace(/\./g, '/'));
  if (!cdnKeyPath) return undefined;

  const relative = thumbnail.replace(/^\/+/, '');
  if (!relative) return undefined;

  return `${cdnKeyPath}/public/${relative}`;
}
