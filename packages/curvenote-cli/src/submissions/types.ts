import type { CollectionDTO, SubmissionKindDTO } from '@curvenote/common';
import type { CompiledCheckResults } from '../check/types.js';
import type { BaseOpts, GithubSource, IdAndDate } from '../logs/types.js';
import type { WorkPushLog } from '../works/types.js';

export type STATUS_ACTIONS = 'publish' | 'unpublish';

export type SubmitOpts = BaseOpts & {
  kind?: string;
  collection?: string;
  draft?: boolean;
  new?: boolean;
  skipRebuild?: boolean;
};

export type JobResponse = {
  id: string;
  status: string;
  results?: Record<string, any>;
};

export type SubmitLog = WorkPushLog & {
  input?: {
    venue: string;
    opts?: SubmitOpts;
  };
  submission?: IdAndDate;
  submissionVersion?: IdAndDate;
  venue?: string;
  kind?: SubmissionKindDTO;
  report?: CompiledCheckResults;
  job?: JobResponse;
  buildUrl?: string;
};

export type NewCheckJobPayload = {
  site: string;
  collection: CollectionDTO;
  kind: SubmissionKindDTO;
  source: GithubSource;
  key: string;
};

export type NewCheckJobResults = {
  checks: {
    venue: string;
    kind: SubmissionKindDTO;
    report?: CompiledCheckResults;
  };
};

export interface CreateSubmissionBody {
  work_version_id: string;
  collection_id: string;
  kind_id: string;
  draft: boolean;
  job_id: string;
}

export interface UpdateSubmissionBody {
  work_version_id: string;
  job_id: string;
}

export interface CreateCliCheckJobPostBody {
  job_type: 'CLI_CHECK';
  payload: Record<string, any>;
  results: Record<string, any>;
}

export interface UpdateCliCheckJobPostBody {
  status: string;
  message: string;
  results: Record<string, any>;
}
