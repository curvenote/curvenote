import type { dbGetSubmission, dbGetWorkVersionsWithSubmissionVersions } from './db.server';

export type SubmissionWithSiteAndCollection = NonNullable<
  Awaited<ReturnType<typeof dbGetSubmission>>
>;

export type WorkVersionWithSubmissionVersions = NonNullable<
  Awaited<ReturnType<typeof dbGetWorkVersionsWithSubmissionVersions>>
>[0];

export type SubmissionWithVersionsAndSite =
  WorkVersionWithSubmissionVersions['submissionVersions'][number]['submission'] & {
    versions: WorkVersionWithSubmissionVersions['submissionVersions'];
  };
