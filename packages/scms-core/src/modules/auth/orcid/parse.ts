/**
 * Shared ORCID API response parsing (used by auth/linking and by public lookup).
 * Parses name, email, and affiliations from ORCID API responses so we don't duplicate logic.
 */

import type { ORCIDPersonResponse, ORCIDEmail } from './types.js';

/**
 * Parse display name from ORCID API v3 person JSON (given-names + family-name).
 */
export function parseOrcidPersonName(personJson: unknown): string | null {
  if (!personJson || typeof personJson !== 'object') return null;
  const obj = personJson as Record<string, unknown>;
  const name = obj.name as ORCIDPersonResponse['name'] | undefined;
  if (!name || typeof name !== 'object') return null;
  const given = name['given-names']?.value ?? '';
  const family = name['family-name']?.value ?? '';
  const givenVal = typeof given === 'string' ? given.trim() : '';
  const familyVal = typeof family === 'string' ? family.trim() : '';
  const full = [givenVal, familyVal].filter(Boolean).join(' ');
  return full || null;
}

/**
 * Get the primary or first email from ORCID emails.
 * Accepts: (a) ORCIDPersonResponse (person object with person.emails?.email),
 *         (b) { email: ORCIDEmail[] }, (c) ORCIDEmail[].
 */
export function parseOrcidPrimaryEmail(emailsSource: unknown): string | undefined {
  let list: ORCIDEmail[] | undefined;
  if (emailsSource && typeof emailsSource === 'object') {
    const obj = emailsSource as Record<string, unknown>;
    if (Array.isArray(obj)) {
      list = obj as ORCIDEmail[];
    } else if (
      obj.emails &&
      typeof obj.emails === 'object' &&
      Array.isArray((obj.emails as Record<string, unknown>).email)
    ) {
      list = (obj.emails as { email: ORCIDEmail[] }).email;
    } else if (Array.isArray(obj.email)) {
      list = obj.email as ORCIDEmail[];
    }
  }
  if (!list?.length) return undefined;
  const primary =
    list.find((e) => e?.primary && e?.verified) ?? list.find((e) => e?.primary) ?? list[0];
  const email = primary?.email?.trim();
  return email && /@/.test(email) ? email : undefined;
}

/** Affiliation parsed from ORCID employments/educations API (organization name + address + optional ROR). */
export type OrcidAffiliation = {
  name: string;
  city?: string;
  region?: string;
  country?: string;
  /** ROR ID when present (disambiguation-source ROR); full URL e.g. https://ror.org/03yrm5c26 */
  ror?: string;
};

/**
 * Parse affiliation objects (name, city, region, country) from ORCID employments/educations API.
 * Response shape: affiliation-group[] with summaries[] containing employment-summary | education-summary | invited-position-summary.
 * Each summary has organization: { name, address?: { city?, region?, country? } }.
 */
export function parseOrcidAffiliations(json: unknown): OrcidAffiliation[] {
  const out: OrcidAffiliation[] = [];
  const seen = new Set<string>();
  if (!json || typeof json !== 'object') return out;
  const obj = json as Record<string, unknown>;
  const groups = obj['affiliation-group'] as unknown[] | undefined;
  if (!Array.isArray(groups)) return out;
  for (const g of groups) {
    const grp = g as Record<string, unknown>;
    const summaries = grp['summaries'] as unknown[] | undefined;
    if (!Array.isArray(summaries)) continue;
    for (const s of summaries) {
      const sum = s as Record<string, unknown>;
      const summary =
        sum['employment-summary'] ?? sum['education-summary'] ?? sum['invited-position-summary'];
      const item = summary as Record<string, unknown> | undefined;
      if (!item || typeof item !== 'object') continue;
      const org = item.organization as Record<string, unknown> | undefined;
      if (!org || typeof org !== 'object') continue;
      const nameRaw = org.name;
      const name =
        typeof nameRaw === 'string'
          ? nameRaw.trim()
          : typeof (nameRaw as { value?: string })?.value === 'string'
            ? (nameRaw as { value: string }).value.trim()
            : '';
      if (!name) continue;
      const addr = org.address as Record<string, unknown> | undefined;
      const city =
        typeof addr?.city === 'string'
          ? addr.city.trim()
          : typeof (addr?.city as { value?: string })?.value === 'string'
            ? String((addr!.city as { value: string }).value).trim()
            : undefined;
      const region =
        typeof addr?.region === 'string'
          ? addr.region.trim()
          : typeof (addr?.region as { value?: string })?.value === 'string'
            ? String((addr!.region as { value: string }).value).trim()
            : undefined;
      const country =
        typeof addr?.country === 'string'
          ? addr.country.trim()
          : typeof (addr?.country as { value?: string })?.value === 'string'
            ? String((addr!.country as { value: string }).value).trim()
            : undefined;
      const disambiguated = org['disambiguated-organization'] as
        | {
            'disambiguation-source'?: string | { value?: string };
            'disambiguated-organization-identifier'?: string | { value?: string };
          }
        | undefined;
      const sourceRaw = disambiguated?.['disambiguation-source'];
      const source =
        typeof sourceRaw === 'string'
          ? sourceRaw
          : typeof (sourceRaw as { value?: string })?.value === 'string'
            ? (sourceRaw as { value: string }).value
            : undefined;
      const idRaw = disambiguated?.['disambiguated-organization-identifier'];
      const idValue =
        typeof idRaw === 'string'
          ? idRaw.trim()
          : typeof (idRaw as { value?: string })?.value === 'string'
            ? String((idRaw as { value: string }).value).trim()
            : undefined;
      const ror = source === 'ROR' && idValue ? idValue : undefined;
      const key = [name, city ?? '', region ?? '', country ?? ''].join('\0');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        name,
        ...(city && { city }),
        ...(region && { region }),
        ...(country && { country }),
        ...(ror && { ror }),
      });
    }
  }
  return out;
}

/**
 * Parse organization names from ORCID employments/educations API (legacy; use parseOrcidAffiliations for full objects).
 */
export function parseOrcidAffiliationNames(json: unknown): string[] {
  return parseOrcidAffiliations(json).map((a) => a.name);
}
