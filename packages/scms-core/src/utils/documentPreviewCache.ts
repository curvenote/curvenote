import { isPreviewCandidate } from './manuscriptFormats.js';

/** Object table type/id prefix for cached upload document preview entries. */
export const DOCUMENT_PREVIEW_CACHE_PREFIX = 'upload:preview:';

/**
 * Older cache prefixes whose rows are keyed by md5 only (no work version). Still removed
 * during confirm-work cleanup so legacy rows don't linger after the scheme change.
 */
export const LEGACY_PREVIEW_CACHE_PREFIXES = ['docx:preview:v2:', 'docx:preview:'] as const;

/**
 * Version-scoped legacy prefixes (same `{workVersionId}:{md5}` suffix as the current scheme).
 */
export const LEGACY_VERSION_SCOPED_PREVIEW_CACHE_PREFIXES = ['docx:preview:v3:'] as const;

type FilesMetadata = {
  files?: Record<string, { path?: string; name?: string; type?: string; md5?: string }>;
};

/** Object-table id for a work version's cached preview of a given source-file md5. */
export function documentPreviewCacheId(workVersionId: string, md5: string): string {
  return `${DOCUMENT_PREVIEW_CACHE_PREFIX}${workVersionId}:${md5}`;
}

/** Distinct md5s of the preview-candidate files in a work version's metadata.files. */
export function previewCandidateMd5s(metadata: unknown): string[] {
  const files = (metadata as FilesMetadata | null | undefined)?.files;
  if (!files || typeof files !== 'object' || Array.isArray(files)) return [];
  return Array.from(
    new Set(
      Object.values(files)
        .filter((file) => isPreviewCandidate(file))
        .map((file) => file.md5)
        .filter((md5): md5 is string => typeof md5 === 'string' && md5.length > 0),
    ),
  );
}

/**
 * Version-scoped Object-table cache ids for a work version's preview-candidate files.
 */
export function previewCacheObjectIds(workVersionId: string, metadata: unknown): string[] {
  return previewCandidateMd5s(metadata).map((md5) => documentPreviewCacheId(workVersionId, md5));
}

/**
 * Legacy md5-only cache ids for a work version's preview-candidate files.
 */
export function legacyPreviewCacheIds(metadata: unknown): string[] {
  const md5s = previewCandidateMd5s(metadata);
  if (md5s.length === 0) return [];
  return Array.from(
    new Set(
      md5s.flatMap((md5) => LEGACY_PREVIEW_CACHE_PREFIXES.map((prefix) => `${prefix}${md5}`)),
    ),
  );
}

/**
 * Legacy version-scoped cache ids (e.g. docx:preview:v3) for cleanup after prefix changes.
 */
export function legacyVersionScopedPreviewCacheIds(
  workVersionId: string,
  metadata: unknown,
): string[] {
  return previewCandidateMd5s(metadata).flatMap((md5) =>
    LEGACY_VERSION_SCOPED_PREVIEW_CACHE_PREFIXES.map(
      (prefix) => `${prefix}${workVersionId}:${md5}`,
    ),
  );
}

/** Current and legacy Object-table ids to delete for a work version's preview cache. */
export function allPreviewCacheObjectIdsForCleanup(
  workVersionId: string,
  metadata: unknown,
): string[] {
  return Array.from(
    new Set([
      ...previewCacheObjectIds(workVersionId, metadata),
      ...legacyVersionScopedPreviewCacheIds(workVersionId, metadata),
      ...legacyPreviewCacheIds(metadata),
    ]),
  );
}
