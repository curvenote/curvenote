/**
 * Helpers for myst-curvenote-web: only files under the Foundry MyST package prefix
 * are sent to / accepted by the converter task.
 */

export const DEFAULT_MYST_WEB_SOURCES_PREFIX = 'sources/myst';

/** Resolve Foundry publish.sourcesPrefix (default sources/myst). */
export function resolveMystWebSourcesPrefix(metadata: unknown): string {
  const foundry = (metadata as { foundry?: { publish?: { sourcesPrefix?: string } } } | null)
    ?.foundry;
  const prefix = foundry?.publish?.sourcesPrefix?.trim();
  return prefix && prefix.length > 0 ? prefix.replace(/\/$/, '') : DEFAULT_MYST_WEB_SOURCES_PREFIX;
}

/**
 * Relative path inside the MyST package (e.g. manuscript.md, media/x.png),
 * or null if the entry does not start with `{cdnKey/}?{sourcesPrefix}/`.
 */
export function mystWebPackageRelativePath(
  fullPath: string,
  sourcesPrefix: string,
  cdnKey: string,
): string | null {
  const full = fullPath.replace(/^\/+/, '');
  const candidates: string[] = [];
  if (cdnKey.trim()) candidates.push(`${cdnKey.replace(/\/$/, '')}/${sourcesPrefix}/`);
  candidates.push(`${sourcesPrefix}/`);

  for (const marker of candidates) {
    if (!full.startsWith(marker)) continue;
    const rel = full.slice(marker.length);
    return rel.length > 0 ? rel : null;
  }
  return null;
}

/** Reject empty, absolute, or `..` path segments so downloads stay under workDir. */
export function isSafeMystWebPackageRelativePath(rel: string): boolean {
  if (!rel || rel.startsWith('/') || rel.includes('\0')) return false;
  const normalized = rel.replace(/\\/g, '/');
  return !normalized.split('/').some((seg) => seg === '..');
}

type FileLike = { path?: string; name?: string; [key: string]: unknown };

/**
 * Keep only file-map entries whose path (or key) sits under the MyST package prefix.
 */
export function filterFilesToMystWebPackage(
  files: Record<string, unknown>,
  sourcesPrefix: string,
  cdnKey: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [pathKey, entry] of Object.entries(files)) {
    if (!entry || typeof entry !== 'object') continue;
    const file = entry as FileLike;
    const full = String(file.path || pathKey || '').replace(/^\/+/, '');
    const rel = mystWebPackageRelativePath(full, sourcesPrefix, cdnKey);
    if (!rel || !isSafeMystWebPackageRelativePath(rel)) continue;
    out[pathKey] = entry;
  }
  return out;
}
