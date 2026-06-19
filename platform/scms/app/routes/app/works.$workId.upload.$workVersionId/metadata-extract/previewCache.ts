/**
 * Shared identifiers for document-preview cache rows in the Object table.
 *
 * Preview cache rows are scoped per work version AND per source-file md5, so a row id is
 * `${DOCUMENT_PREVIEW_CACHE_PREFIX}${workVersionId}:${md5}`. Scoping by work version (in
 * addition to the content md5) keeps each version's cache isolated: cleaning up one
 * version never drops another version's (or another work's) rows, even if they uploaded a
 * byte-identical file.
 *
 * Client-safe: no server-only dependencies, so both the upload route (generation +
 * confirm cleanup) and the drafts list (delete cleanup) can share this module.
 */

import { isPreviewCandidate } from './previewGuards';

/** Object table type/id prefix for cached document preview entries (versioned). */
export const DOCUMENT_PREVIEW_CACHE_PREFIX = 'docx:preview:v3:';

/**
 * Older cache prefixes whose rows are keyed by md5 only (no work version). Still removed
 * during confirm-work cleanup so legacy rows don't linger after the scheme change. Not
 * used by the draft-delete path, which stays strictly version-scoped to avoid touching
 * rows that may belong to another work.
 */
export const LEGACY_PREVIEW_CACHE_PREFIXES = ['docx:preview:v2:', 'docx:preview:'];

/** Object-table id for a work version's cached preview of a given source-file md5. */
export function documentPreviewCacheId(workVersionId: string, md5: string): string {
  return `${DOCUMENT_PREVIEW_CACHE_PREFIX}${workVersionId}:${md5}`;
}

type FilesMetadata = {
  files?: Record<string, { path?: string; name?: string; type?: string; md5?: string }>;
};

/** Distinct md5s of the preview-candidate files in a work version's metadata.files. */
export function previewCandidateMd5s(metadata: unknown): string[] {
  const files = (metadata as FilesMetadata | null | undefined)?.files;
  if (!files || typeof files !== 'object') return [];
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
 * Version-scoped (current-scheme) Object-table cache ids for a work version's
 * preview-candidate files. Strictly tied to this work version — safe to delete without
 * affecting any other work or version.
 */
export function previewCacheObjectIds(workVersionId: string, metadata: unknown): string[] {
  return previewCandidateMd5s(metadata).map((md5) => documentPreviewCacheId(workVersionId, md5));
}

/**
 * Legacy md5-only cache ids for a work version's preview-candidate files. These predate
 * version scoping and may be shared across works, so only the confirm-work cleanup (which
 * already accepts that trade-off) should remove them.
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
