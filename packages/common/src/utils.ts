import type { Author, CurvenotePlugin, ValidatedCurvenotePlugin } from './types/index.js';

export function getDate(object: undefined | Date | string | { toDate: () => Date }): Date {
  if (!object) {
    return new Date();
  }
  if (object instanceof Date) {
    return object;
  }
  if (typeof object === 'string') {
    return new Date(object);
  }
  if (object?.toDate !== undefined) {
    return object.toDate();
  }
  throw new Error(`Could not parse date: ${object}`);
}

export function formatDate(date?: string | Date | { toDate: () => Date }): string {
  if (date instanceof Date) {
    return date.toISOString();
  }
  if (typeof date === 'string') {
    return formatDate(getDate(date));
  }
  if (date?.toDate !== undefined) {
    return date.toDate().toISOString();
  }
  return new Date().toISOString();
}

export function formatAuthors(authors?: string | Author | string[] | Author[]): Author[] {
  if (!authors) return [];
  if (typeof authors === 'string') return [{ name: authors }];
  if ('name' in authors) return formatAuthors([authors]);
  return authors.map((author) => {
    if (typeof author === 'string') return { name: author };
    return { name: author.name, orcid: author.orcid };
  });
}

export function formatAuthorsAsString(authors: string | Author | string[] | Author[]): string {
  return formatAuthors(authors)
    .map(({ name }) => name)
    .join(', ');
}

export function combinePlugins(plugins: CurvenotePlugin[]): ValidatedCurvenotePlugin {
  return plugins.slice(1).reduce(
    (base, next) => ({
      directives: [...(base.directives ?? []), ...(next.directives ?? [])],
      roles: [...(base.roles ?? []), ...(next.roles ?? [])],
      transforms: [...(base.transforms ?? []), ...(next.transforms ?? [])],
      checks: [...(base.checks ?? []), ...(next.checks ?? [])],
    }),
    plugins[0],
  ) as ValidatedCurvenotePlugin;
}

/**
 * Read tags out of a `metadata` JSON blob.
 *
 * Returns a deduplicated array of trimmed, non-empty strings.
 */
export function getTagsFromMetadata(metadata: unknown): string[] {
  if (metadata == null || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
  const raw = (metadata as { tags?: unknown }).tags;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const t = v.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * Merge the provided `tags` into a `metadata` JSON blob under the `tags` key.
 *
 * - `tags` is trimmed, deduplicated, non-empty strings
 * - Returns `undefined` if the resulting object is empty (no metadata, no
 *   tags)
 * - Existing top-level fields on `metadata` are preserved; only `tags` is
 *   replaced.
 */
export function setTagsOnMetadata(
  metadata: unknown,
  tags: string[] | undefined,
): Record<string, any> | undefined {
  const base: Record<string, any> =
    metadata != null && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, any>) }
      : {};
  const cleaned: string[] = [];
  if (Array.isArray(tags)) {
    const seen = new Set<string>();
    for (const v of tags) {
      if (typeof v !== 'string') continue;
      const t = v.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      cleaned.push(t);
    }
  }
  if (cleaned.length > 0) {
    base.tags = cleaned;
  } else {
    delete base.tags;
  }
  if (Object.keys(base).length === 0) return undefined;
  return base;
}
