/** Values of `SiteDoiConfig.status`. Stored as a string column, like `SubmissionVersion.status`. */
export const SITE_DOI_CONFIG_STATUS = {
  PENDING_ROLE: 'PENDING_ROLE',
  ACTIVE: 'ACTIVE',
  NEEDS_ATTENTION: 'NEEDS_ATTENTION',
} as const;

export type SiteDoiConfigStatus =
  (typeof SITE_DOI_CONFIG_STATUS)[keyof typeof SITE_DOI_CONFIG_STATUS];

const STATUSES = new Set<string>(Object.values(SITE_DOI_CONFIG_STATUS));

export function isSiteDoiConfigStatus(value: unknown): value is SiteDoiConfigStatus {
  return typeof value === 'string' && STATUSES.has(value);
}
