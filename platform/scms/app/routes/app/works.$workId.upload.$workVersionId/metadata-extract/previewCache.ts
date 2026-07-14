/**
 * Shared identifiers for document-preview cache rows in the Object table.
 *
 * Re-exports from scms-core (single source of truth). See documentPreviewCache.ts.
 */

export {
  DOCUMENT_PREVIEW_CACHE_PREFIX,
  LEGACY_PREVIEW_CACHE_PREFIXES,
  LEGACY_VERSION_SCOPED_PREVIEW_CACHE_PREFIXES,
  documentPreviewCacheId,
  legacyPreviewCacheIds,
  legacyVersionScopedPreviewCacheIds,
  allPreviewCacheObjectIdsForCleanup,
  previewCacheObjectIds,
  previewCandidateMd5s,
} from '@curvenote/scms-core';
