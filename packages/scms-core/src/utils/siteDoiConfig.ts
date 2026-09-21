/** Values of `SiteDoiConfig.mode`. CURVENOTE_PREFIX sites share Curvenote's prefix and role. */
export const SITE_DOI_CONFIG_MODE = {
  CURVENOTE_PREFIX: 'CURVENOTE_PREFIX',
  CUSTOM_PREFIX: 'CUSTOM_PREFIX',
} as const;

export type SiteDoiConfigMode = (typeof SITE_DOI_CONFIG_MODE)[keyof typeof SITE_DOI_CONFIG_MODE];

/**
 * Values of `SiteDoiConfig.status`. Stored as a string column, like `SubmissionVersion.status`.
 * NEEDS_ATTENTION is only "the bound role no longer authenticates" (a 401 under a role that once
 * validated); a rejected deposit is that registration's failure and leaves the site ACTIVE.
 */
export const SITE_DOI_CONFIG_STATUS = {
  PENDING_ROLE: 'PENDING_ROLE',
  ACTIVE: 'ACTIVE',
  NEEDS_ATTENTION: 'NEEDS_ATTENTION',
} as const;

export type SiteDoiConfigStatus =
  (typeof SITE_DOI_CONFIG_STATUS)[keyof typeof SITE_DOI_CONFIG_STATUS];
