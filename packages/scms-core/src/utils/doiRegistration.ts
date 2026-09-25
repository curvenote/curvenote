/** Values of `DoiRegistration.status`. Stored as a string column, like `SubmissionVersion.status`. */
export const DOI_REGISTRATION_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTING: 'SUBMITTING',
  REGISTERED: 'REGISTERED',
  FAILED: 'FAILED',
} as const;

export type DoiRegistrationStatus =
  (typeof DOI_REGISTRATION_STATUS)[keyof typeof DOI_REGISTRATION_STATUS];

/**
 * Values of `DoiDeposit.status`: one per deposit attempt. A record Crossref accepted with a
 * warning is SUCCEEDED with `DoiDeposit.warning` set, so "is it registered" stays one check.
 */
export const DOI_DEPOSIT_STATUS = {
  PENDING: 'PENDING',
  QUEUED: 'QUEUED',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
} as const;

export type DoiDepositStatus = (typeof DOI_DEPOSIT_STATUS)[keyof typeof DOI_DEPOSIT_STATUS];

/** The three places a site work's DOI can come from, most authoritative first. */
export type SiteWorkDoiSources = {
  /** `Submission.doi`, set when a Curvenote registration first succeeds. */
  submission: string | null | undefined;
  /** `WorkVersion.doi`: the DOI this version of the work arrived with. */
  workVersion: string | null | undefined;
  /** `Work.doi`: the DOI the work arrived with, when the version carries none. */
  work?: string | null;
};

/**
 * A DOI registered through Curvenote lives on the submission and wins over the one the work
 * arrived with. Keep every site-work DOI going through here: the resolvers probe `Submission.doi`
 * before work DOIs (`loaders/sites/doi.server.ts`, `loaders/doi/resolve.server.ts`), so a caller
 * that reads the work DOI directly would show a different DOI than the one that resolves.
 */
export function resolveSiteWorkDoi(sources: SiteWorkDoiSources): string | undefined {
  return sources.submission ?? sources.workVersion ?? sources.work ?? undefined;
}
