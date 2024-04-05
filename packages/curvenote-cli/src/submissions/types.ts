import type { CollectionDTO, SubmissionKindDTO } from '@curvenote/common';
import type { CompiledCheckResults } from '../check/types.js';

export type SubmitOpts = {
  kind?: string;
  collection?: string;
  yes?: boolean;
  info: boolean;
  draft?: boolean;
  new?: boolean;
  resume?: boolean;
  maxSizeWebp?: number;
};

export type GithubSource = {
  repo?: string;
  branch?: string;
  path?: string;
  commit?: string;
};

type idAndDate = {
  id?: string;
  date_created: string;
};

export type JobResponse = {
  id: string;
  status: string;
  results?: Record<string, any>;
};

export type SubmitLog = {
  input?: {
    venue: string;
    opts?: SubmitOpts;
  };
  work?: idAndDate;
  workVersion?: idAndDate;
  submission?: idAndDate;
  submissionVersion?: idAndDate;
  key?: string;
  venue?: string;
  kind?: SubmissionKindDTO;
  source?: GithubSource;
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
