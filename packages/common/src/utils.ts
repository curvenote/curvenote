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
 * Normalize top-level `tags` on API bodies: trim, non-empty, dedupe, preserve first-seen order.
 */
export function normalizeExplicitTags(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of tags) {
    if (typeof v !== 'string') continue;
    const t = v.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * Site work DTO: submission tags first, then work-version tags, deduped (submission order first).
 */
export function concatSiteWorkTags(submissionTags: string[], workVersionTags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of submissionTags) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  for (const t of workVersionTags) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}
