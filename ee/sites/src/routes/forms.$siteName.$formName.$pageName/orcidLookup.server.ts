/**
 * Server-side ORCID public API lookup (read-only, no auth flow).
 * Fetches person name, email, and affiliations from ORCID record for auto-filling author fields.
 * Uses shared ORCID parsing from @curvenote/scms-core (same as auth/linking) for name and email.
 * Optional: set ORCID_CLIENT_ID and ORCID_CLIENT_SECRET for higher quota; otherwise uses unauthenticated read.
 */

import { orcid } from '@curvenote/scms-core';

const ORCID_API_BASE = 'https://api.orcid.org';
const ORCID_PUB_BASE = 'https://pub.orcid.org';

export type OrcidAffiliationResult = {
  name: string;
  city?: string;
  region?: string;
  country?: string;
};

export type OrcidPersonResult = {
  name: string;
  orcid: string;
  email?: string;
  affiliations: OrcidAffiliationResult[];
};

async function getOrcidAccessToken(): Promise<string | null> {
  const clientId = process.env.ORCID_CLIENT_ID;
  const clientSecret = process.env.ORCID_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
    scope: '/read-public',
  });
  const res = await fetch(`${ORCID_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

async function orcidFetch(base: string, path: string, token: string | null): Promise<unknown> {
  const url = `${base}/v3.0${path}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Fetch public person data for an ORCID iD: name, email (if public), and affiliations (name, city, country) from employments/educations.
 */
export async function fetchOrcidPerson(orcidId: string): Promise<OrcidPersonResult | null> {
  const trimmed = orcidId.trim();
  if (!/^\d{4}-\d{4}-\d{4}-\d{4}$/.test(trimmed)) return null;

  const token = await getOrcidAccessToken();
  const base = token ? ORCID_API_BASE : ORCID_PUB_BASE;
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
