/**
 * Postgres affiliation search extractor for the public works listing text
 * search. Must match `work_version_affiliations_search_text()` and
 * `WorkVersion_affiliations_trgm_idx` (migration
 * `20260610120000_add_work_version_affiliations_trgm_index`).
 */
export const WORK_VERSION_AFFILIATIONS_SEARCH_TEXT_FN = 'work_version_affiliations_search_text';

/**
 * Boilerplate affiliation tokens excluded from the affiliation search branch of
 * `q`. Title / author / DOI matching is unaffected. Enable the branch only when
 * at least one query token is not on this list.
 */
export const AFFILIATION_SEARCH_STOP_TERMS = new Set([
  'centre',
  'center',
  'college',
  'department',
  'faculty',
  'hospital',
  'institute',
  'institution',
  'laboratory',
  'lab',
  'medical',
  'research',
  'school',
  'sciences',
  'science',
  'university',
]);

/** Minimum token length required to treat a word as affiliation-significant. */
export const AFFILIATION_SEARCH_MIN_TOKEN_LENGTH = 3;

function tokenizeAffiliationSearchQuery(q: string): string[] {
  return q
    .trim()
    .split(/\s+/)
    .map((token) => token.toLowerCase())
    .filter(Boolean);
}

/**
 * Whether the affiliation ILIKE branch should run for this `q`. Returns false
 * when every token is a stopword or shorter than {@link AFFILIATION_SEARCH_MIN_TOKEN_LENGTH}.
 */
export function isAffiliationSearchEnabled(q: string): boolean {
  return tokenizeAffiliationSearchQuery(q).some(
    (token) =>
      token.length >= AFFILIATION_SEARCH_MIN_TOKEN_LENGTH &&
      !AFFILIATION_SEARCH_STOP_TERMS.has(token),
  );
}

function affiliationObjectToSearchFragment(aff: Record<string, unknown>): string | undefined {
  const name = typeof aff.name === 'string' ? aff.name.trim() : '';
  if (name) return name;

  const institution = typeof aff.institution === 'string' ? aff.institution.trim() : '';
  return institution || undefined;
}

/**
 * Read searchable affiliation text from `metadata['frontmatter.myst'].affiliations`.
 * Mirrors the Postgres `work_version_affiliations_search_text` function.
 */
export function extractWorkVersionAffiliationsSearchTextFromMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') return '';
  const myst = (metadata as Record<string, unknown>)['frontmatter.myst'];
  if (!myst || typeof myst !== 'object') return '';

  const affiliations = (myst as Record<string, unknown>).affiliations;
  if (!Array.isArray(affiliations)) return '';

  const fragments: string[] = [];
  for (const aff of affiliations) {
    if (!aff || typeof aff !== 'object' || Array.isArray(aff)) continue;
    const fragment = affiliationObjectToSearchFragment(aff as Record<string, unknown>);
    if (fragment) fragments.push(fragment);
  }
  return fragments.join(' ').trim();
}
