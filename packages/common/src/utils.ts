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
