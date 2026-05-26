import type { dbGetSubmission, WorkVersionWithSubmissionVersions } from './db.server';
import type { LicenseDisplay } from './metadata.server';

export type SubmissionWithSiteAndCollection = NonNullable<
  Awaited<ReturnType<typeof dbGetSubmission>>
>;

export type { WorkVersionWithSubmissionVersions };

/** Parent loader serializes versions with signed file metadata only (no myst/checks/license). */
export type WorkVersionForDetailsClient = WorkVersionWithSubmissionVersions & {
  metadata?: { files?: Record<string, unknown> };
};

export type WorkVersionContentCardData = {
  title: string;
  authors: string[];
  author_details?: unknown[];
  doi?: string | null;
  license: LicenseDisplay;
};

export type SubmissionWithVersionsAndSite =
  WorkVersionWithSubmissionVersions['submissionVersions'][number]['submission'] & {
    versions: WorkVersionWithSubmissionVersions['submissionVersions'];
  };
