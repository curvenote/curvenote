export interface WorkBody {
  cdn_key: string;
  cdn: string;
}

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

export type STATUS_ACTIONS = 'publish' | 'unpublish';

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
