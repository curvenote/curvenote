/** Values of `SiteDoiConfig.mode`. CURVENOTE sites share Curvenote's prefix and role. */
export const SITE_DOI_CONFIG_MODE = {
  CURVENOTE: 'CURVENOTE',
  CUSTOM: 'CUSTOM',
} as const;

export type SiteDoiConfigMode = (typeof SITE_DOI_CONFIG_MODE)[keyof typeof SITE_DOI_CONFIG_MODE];

/** Values of `SiteDoiConfig.status`. Stored as a string column, like `SubmissionVersion.status`. */
export const SITE_DOI_CONFIG_STATUS = {
  PENDING_ROLE: 'PENDING_ROLE',
  ACTIVE: 'ACTIVE',
  NEEDS_ATTENTION: 'NEEDS_ATTENTION',
} as const;

export type SiteDoiConfigStatus =
  (typeof SITE_DOI_CONFIG_STATUS)[keyof typeof SITE_DOI_CONFIG_STATUS];
