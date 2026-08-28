import { buildUrl } from 'doi-utils';

export function authorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function getNamedAuthors(authors: { name: string }[] | undefined): { name: string }[] {
  return authors?.filter((author) => author.name.trim().length > 0) ?? [];
}

export function getDoiHref(doi: string | undefined): string | undefined {
  return doi ? buildUrl(doi) : undefined;
}
