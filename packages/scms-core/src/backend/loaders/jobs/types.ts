import type { JobStatus } from '@curvenote/scms-db';

/** Spec for a single follow-on job (job_type + payload, optional id). */
export type FollowOnSpec = {
  job_type: string;
  id?: string;
  payload: Record<string, any>;
};

/** Stored shape of Job.follow_on: inline JSON Schema + on_success spec. */
export type FollowOnEnvelope = {
  $schema: Record<string, any>;
  on_success: FollowOnSpec;
};

export type CreateJob = {
  id: string;
  job_type: string;
  payload: Record<string, any>;
  status?: JobStatus;
  message?: string;
  results?: Record<string, any>;
  follow_on?: FollowOnEnvelope;
};

export type UpdateJob = {
  status: JobStatus;
  message?: string;
  results?: Record<string, any>;
};
