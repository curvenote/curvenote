import type { $Enums } from '@curvenote/scms-db';

export type CreateJob = {
  id: string;
  job_type: string;
  payload: Record<string, any>;
  status?: $Enums.JobStatus;
  message?: string;
  results?: Record<string, any>;
};

export type UpdateJob = {
  status: $Enums.JobStatus;
  message?: string;
  results?: Record<string, any>;
};
