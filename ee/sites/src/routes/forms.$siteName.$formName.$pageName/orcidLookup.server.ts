/**
 * Server-side ORCID public API lookup (read-only, no auth flow).
 * Fetches person name, email, and affiliations from ORCID record for auto-filling author fields.
 * Uses shared ORCID parsing from @curvenote/scms-core (same as auth/linking) for name and email.
 * Uses auth.orcid clientId/clientSecret from app-config (same as ORCID sign-in) to obtain a
 * /read-public token for lookup and search; otherwise falls back to unauthenticated read where allowed.
 */

import { orcid } from '@curvenote/scms-core';
import { getConfig } from '@curvenote/scms-server';

const ORCID_PUB_BASE = 'https://pub.orcid.org';

export type OrcidAffiliationResult = {
  name: string;
  city?: string;
  region?: string;
  country?: string;
  /** ROR ID when present (e.g. https://ror.org/03yrm5c26) */
  ror?: string;
};

export type OrcidPersonResult = {
  name: string;
  orcid: string;
  email?: string;
  affiliations: OrcidAffiliationResult[];
};

async function getOrcidAccessToken(): Promise<string | null> {
  const config = await getConfig();
  const clientId = config.auth?.orcid?.clientId;
  const clientSecret = config.auth?.orcid?.clientSecret;
  if (!clientId || !clientSecret) return null;
  const orcidBaseUrl = config.auth?.orcid?.orcidBaseUrl ?? 'https://orcid.org';
  const tokenUrl = `${orcidBaseUrl}/oauth/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
    scope: '/read-public',
  });
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

async function orcidFetch(
  base: string,
  path: string,
  token: string | null,
  accept = 'application/json',
): Promise<unknown> {
  const url = `${base}/v3.0${path}`;
  const headers: Record<string, string> = { Accept: accept };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) return null;
  return res.json();
}

export type OrcidSearchHit = {
  orcid: string;
  name: string;
  firstAffiliation?: string;
  email?: string;
};

/**
 * Search ORCID by free-text query (e.g. name). Requires read-public token (ORCID_CLIENT_ID/SECRET).
 * Returns up to 10 hits with orcid and display name. Returns [] if no token or parse failure.
 */
export async function searchOrcid(query: string): Promise<OrcidSearchHit[]> {
  const trimmed = (query ?? '').trim();
  if (trimmed.length < 2) return [];

  const token = await getOrcidAccessToken();
  console.log('[ORCID search] searchOrcid: token present=', !!token);
  if (!token) return [];
  // Use Public API base (pub.orcid.org); token from orcid.org OAuth is valid there, not on api.orcid.org (Member API).
  const base = ORCID_PUB_BASE;
  const q = encodeURIComponent(trimmed);
  const path = `/expanded-search/?q=${q}&rows=10`;
  const json = await orcidFetch(base, path, token, 'application/vnd.orcid+json');
  if (!json || typeof json !== 'object') return [];

  // Public API (pub.orcid.org) expanded-search: orcid-id and names are direct strings; institution-name and email are arrays
  const raw = json as {
    'expanded-result'?: Array<{
      'orcid-id'?: string;
      'given-names'?: string | null;
      'family-names'?: string | null;
      'credit-name'?: string | null;
      'institution-name'?: string[];
      email?: string[];
    }>;
  };
  const results = raw['expanded-result'];
  if (!Array.isArray(results)) return [];

  const hits: OrcidSearchHit[] = [];
  for (const r of results) {
    const idRaw = r['orcid-id'];
    const id = typeof idRaw === 'string' ? idRaw.trim() : '';
    if (!id || !/^\d{4}-\d{4}-\d{4}-\d{4}$/.test(id)) continue;
    const credit = typeof r['credit-name'] === 'string' ? r['credit-name'].trim() : '';
    const given = typeof r['given-names'] === 'string' ? r['given-names'].trim() : '';
    const family = typeof r['family-names'] === 'string' ? r['family-names'].trim() : '';
    const name = credit || [given, family].filter(Boolean).join(' ') || id;
    const inst = r['institution-name'];
    const firstAffiliation =
      Array.isArray(inst) && inst.length > 0 && typeof inst[0] === 'string'
        ? inst[0].trim()
        : undefined;
    const em = r['email'];
    const email =
      Array.isArray(em) && em.length > 0 && typeof em[0] === 'string' ? em[0].trim() : undefined;
    hits.push({
      orcid: id,
      name,
      ...(firstAffiliation && { firstAffiliation }),
      ...(email && { email }),
    });
  }
  console.log('[ORCID search] searchOrcid: parsed hits count=', hits.length);
  return hits;
}

/**
 * Fetch public person data for an ORCID iD: name, email (if public), and affiliations (name, city, country) from employments/educations.
 */
export async function fetchOrcidPerson(orcidId: string): Promise<OrcidPersonResult | null> {
  const trimmed = orcidId.trim();
  if (!/^\d{4}-\d{4}-\d{4}-\d{4}$/.test(trimmed)) return null;

  const token = await getOrcidAccessToken();
  // Use Public API (pub.orcid.org) for both authenticated and unauthenticated; token from orcid.org OAuth is valid there only.
  const base = ORCID_PUB_BASE;
  const pathPrefix = `/${trimmed}`;

  const [personJson, emailJson, employmentsJson, educationsJson] = await Promise.all([
    orcidFetch(base, `${pathPrefix}/person`, token),
    orcidFetch(base, `${pathPrefix}/email`, token),
    orcidFetch(base, `${pathPrefix}/employments`, token),
    orcidFetch(base, `${pathPrefix}/educations`, token),
  ]);

  const name = orcid.parseOrcidPersonName(personJson);
  const email = orcid.parseOrcidPrimaryEmail(emailJson);
  const employmentAffs = orcid.parseOrcidAffiliations(employmentsJson);
  const educationAffs = orcid.parseOrcidAffiliations(educationsJson);

  const seen = new Set<string>();
  const affiliations: OrcidAffiliationResult[] = [];
  for (const a of [...employmentAffs, ...educationAffs]) {
    const key = [a.name, a.city ?? '', a.region ?? '', a.country ?? ''].join('\0');
    if (seen.has(key)) continue;
    seen.add(key);
    affiliations.push(a);
  }

  return {
    name: name || trimmed,
    orcid: trimmed,
    ...(email && { email }),
    affiliations,
  };
}

/**
 * Look up a single ORCID by id and return as a one-element search result list (same shape as searchOrcid).
 * Use when the user has typed/pasted an ORCID id so the Add Author dropdown can show that person.
 */
export async function searchOrcidById(orcidId: string): Promise<OrcidSearchHit[]> {
  const person = await fetchOrcidPerson(orcidId.trim());
  if (!person) return [];
  const firstAffiliation =
    person.affiliations && person.affiliations.length > 0 ? person.affiliations[0].name : undefined;
  return [
    {
      orcid: person.orcid,
      name: person.name,
      ...(firstAffiliation && { firstAffiliation }),
      ...(person.email && { email: person.email }),
    },
  ];
}
