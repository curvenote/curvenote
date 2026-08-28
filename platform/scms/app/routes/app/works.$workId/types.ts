import type { dbGetSubmission, WorkVersionWithSubmissionVersions } from './db.server';
import type { LicenseDisplay, WorkVersionClientMetadata } from './metadata.server';

export type SubmissionWithSiteAndCollection = NonNullable<
  Awaited<ReturnType<typeof dbGetSubmission>>
>;

export type { WorkVersionWithSubmissionVersions };

/** Parent loader serializes versions with signed file metadata only (extension markers use timeline descriptors). */
export type WorkVersionForDetailsClient = WorkVersionWithSubmissionVersions & {
  metadata?: WorkVersionClientMetadata;
};

export type WorkVersionContentCardData = {
  title: string;
  authors: string[];
  author_details?: unknown[];
  /** Resolved DOI (version ?? work) for display */
  doi?: string | null;
  license: LicenseDisplay | null;
};

export type SubmissionWithVersionsAndSite =
  WorkVersionWithSubmissionVersions['submissionVersions'][number]['submission'] & {
    versions: WorkVersionWithSubmissionVersions['submissionVersions'];
  };
