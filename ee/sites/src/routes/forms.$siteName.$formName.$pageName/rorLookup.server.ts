/**
 * Server-side ROR (Research Organization Registry) API search.
 * Used to search organizations by name/acronym and auto-fill affiliation name, ROR ID, city, country.
 * ROR API v2 does not require authentication for search (no client ID needed for basic use).
 */

const ROR_API_BASE = 'https://api.ror.org';
const ROR_SEARCH_ROWS = 10;

export type RorSearchHit = {
  name: string;
  ror: string;
  city?: string;
  country?: string;
};

/**
 * Search ROR by free-text query (name or acronym). No auth required.
 * Returns up to 10 hits with name, ror (full URL), city, country. Query immediately (no min length).
 */
export async function searchRor(query: string): Promise<RorSearchHit[]> {
  const trimmed = (query ?? '').trim();
  if (!trimmed) return [];

  const q = encodeURIComponent(trimmed);
  const url = `${ROR_API_BASE}/v2/organizations?query=${q}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    items?: Array<{
      id?: string;
      names?: Array<{ types?: string[]; value?: string }>;
      locations?: Array<{
        geonames_details?: { name?: string; country_code?: string; country_name?: string };
      }>;
    }>;
  };
  const items = json.items;
  if (!Array.isArray(items)) return [];

  const hits: RorSearchHit[] = [];
  for (const item of items) {
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (!id || !id.startsWith('https://ror.org/')) continue;
    const names = item.names;
    let name = '';
    if (Array.isArray(names)) {
      const rorDisplay = names.find(
        (n) => n.types?.includes('ror_display') || n.types?.includes('label'),
      );
      const anyName = names.find((n) => typeof n.value === 'string' && n.value?.trim());
      name = (rorDisplay?.value ?? anyName?.value ?? '').trim();
    }
    if (!name) name = id.replace(/^https:\/\/ror\.org\//, '');
    const loc = item.locations?.[0]?.geonames_details;
    const city = typeof loc?.name === 'string' ? loc.name.trim() : undefined;
    const country =
      typeof loc?.country_name === 'string'
        ? loc.country_name.trim()
        : typeof loc?.country_code === 'string'
          ? loc.country_code.trim()
          : undefined;
    hits.push({
      name,
      ror: id,
      ...(city && { city }),
      ...(country && { country }),
    });
    if (hits.length >= ROR_SEARCH_ROWS) break;
  }
  return hits;
}
