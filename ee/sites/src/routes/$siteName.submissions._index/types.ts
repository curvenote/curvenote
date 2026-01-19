import type { sites, jobs } from '@curvenote/scms-server';
import type { getWorkflow } from '@curvenote/scms-core';

export type ArrayOfJobs = Awaited<ReturnType<typeof jobs.list>>;

export type AugmentedSubmissionsList = {
  items: (Awaited<ReturnType<typeof sites.submissions.list>>['items'][0] & {
    signature: string;
    workflow: ReturnType<typeof getWorkflow>;
  })[];
};

export type AugmentedSubmissionsListWithPagination = {
  items: AugmentedSubmissionsList['items'][0][];
  page?: number;
  perPage?: number;
  total?: number;
  hasMore?: boolean;
};
