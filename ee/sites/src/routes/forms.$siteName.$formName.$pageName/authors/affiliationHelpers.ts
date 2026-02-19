import type { Affiliation } from '../types.js';

export function getAffiliationName(list: Affiliation[], id: string): string {
  const name = list.find((a) => a.id === id)?.name;
  return (name ?? '').trim();
}

/** Subtitle for large affiliation cards: "department · city, country" format. */
export function getAffiliationSubtitle(aff: Affiliation | undefined): string | null {
  if (!aff) return null;
  const dept = (aff.department ?? '').trim();
  const city = (aff.city ?? '').trim();
  const country = (aff.country ?? '').trim();
  const parts: string[] = [];
  if (dept) parts.push(dept);
  const location = [city, country].filter(Boolean).join(', ');
  if (location) parts.push(location);
  return parts.length > 0 ? parts.join(' · ') : null;
}
