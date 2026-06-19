import type { jobs } from '@curvenote/scms-server';
import type { getWorkflow, WorkflowTransition } from '@curvenote/scms-core';

export type ArrayOfJobs = Awaited<ReturnType<typeof jobs.list>>;

/** Narrow kind shape for collection chips (not full SubmissionKindSummaryDTO). */
export type SubmissionListingKind = {
  id: string;
  name: string;
  content: { title?: string; [key: string]: unknown };
};

/** Narrow collection shape for listing chips. */
export type SubmissionListingCollection = {
  id: string;
  name: string;
  slug: string;
  workflow: string;
  open: boolean;
  content: { title?: string; [key: string]: unknown };
};

export type SubmissionListingVersionChip = {
  date_created: string;
  work_id?: string;
};

/**
 * App submissions listing card — intentionally smaller than API SubmissionsListItemDTO.
 */
export type SubmissionListingItem = {
  id: string;
  date_created: string;
  date_published?: string;
  title: string;
  authors: { name: string }[];
  description?: string;
  date?: string;
  doi?: string;
  slug?: string;
  status: string;
  transition?: WorkflowTransition;
  version_id: string;
  job_id?: string;
  kind: SubmissionListingKind;
  collection: SubmissionListingCollection;
  published_version?: SubmissionListingVersionChip;
  retracted_version?: SubmissionListingVersionChip;
  last_activity: {
    date: string;
    by: { id: string; name: string };
  };
  links: { build?: string };
  num_versions: number;
};

export type AugmentedSubmissionListingItem = SubmissionListingItem & {
  workflow: ReturnType<typeof getWorkflow>;
  signature: string;
  job?: ArrayOfJobs['items'][number];
};

export type SubmissionListingPage = {
  items: AugmentedSubmissionListingItem[];
  page?: number;
  perPage?: number;
  hasMore?: boolean;
};

/** @deprecated Use SubmissionListingPage */
export type AugmentedSubmissionsListWithPagination = SubmissionListingPage;

export type SubmissionsIndexItem = {
  id: string;
  title: string;
  authors: { name: string }[];
  datePublished?: string;
  dateFirstSubmitted: string;
  dateLastUpdated: string;
  doi?: string;
  versionTag?: string;
  status: string;
  statusLabel: string;
  publishedVersion?: { date_created: string };
  retractedVersion?: { date_created: string };
  kind: SubmissionListingKind;
  collection: SubmissionListingCollection;
};

export type SubmissionsIndexPage = {
  items: SubmissionsIndexItem[];
  page: number;
  perPage: number;
  total: number;
};
