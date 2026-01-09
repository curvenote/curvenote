import type { JobStatus } from '@prisma/client';

export type CreateJob = {
  id: string;
  job_type: string;
  payload: Record<string, any>;
  status?: JobStatus;
  message?: string;
  results?: Record<string, any>;
};

export type UpdateJob = {
  status: JobStatus;
  message?: string;
  results?: Record<string, any>;
};
