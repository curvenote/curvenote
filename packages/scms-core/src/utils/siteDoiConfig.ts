/** Values of `SiteDoiConfig.mode`. CURVENOTE_PREFIX sites share Curvenote's prefix and role. */
export const SITE_DOI_CONFIG_MODE = {
  CURVENOTE_PREFIX: 'CURVENOTE_PREFIX',
  CUSTOM_PREFIX: 'CUSTOM_PREFIX',
} as const;

export type SiteDoiConfigMode = (typeof SITE_DOI_CONFIG_MODE)[keyof typeof SITE_DOI_CONFIG_MODE];

/**
 * Values of `SiteDoiConfig.status`. Stored as a string column, like `SubmissionVersion.status`.
 * A failed deposit, a Crossref 401 included, is that registration's failure and leaves the site
 * ACTIVE.
 */
export const SITE_DOI_CONFIG_STATUS = {
  PENDING_ROLE: 'PENDING_ROLE',
  ACTIVE: 'ACTIVE',
} as const;

export type SiteDoiConfigStatus =
  (typeof SITE_DOI_CONFIG_STATUS)[keyof typeof SITE_DOI_CONFIG_STATUS];

/**
 * Values of `SubmissionKind.doi_content_type`: what a kind's DOIs are registered as, in Curvenote's
 * own terms. Each registration agency's deposit mapper translates them into its vocabulary.
 */
export const DOI_CONTENT_TYPE = {
  PREPRINT: 'PREPRINT',
} as const;

export type DoiContentType = (typeof DOI_CONTENT_TYPE)[keyof typeof DOI_CONTENT_TYPE];

/**
 * Narrows a stored `doi_content_type`. Anything else, such as a value this build does not know,
 * reads as not eligible.
 */
export function isDoiContentType(value: unknown): value is DoiContentType {
  return (Object.values(DOI_CONTENT_TYPE) as unknown[]).includes(value);
}
