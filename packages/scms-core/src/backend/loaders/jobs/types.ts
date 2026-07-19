import type { JobStatus } from '@curvenote/scms-db';

/**
 * When present, a work-scoped activity is created after the job is invoked.
 * Requires payload.work_version_id and ctx.user; work_id is resolved from the work version.
 * Use activity_data for extra payload (e.g. CHECK_STARTED: { check: { kind } }).
 */
export type CreateJob = {
  id: string;
  job_type: string;
  payload: Record<string, any>;
  status?: JobStatus;
  message?: string;
  results?: Record<string, any>;
  /** User who triggered the job; used for completion/failure activity attribution. */
  invoked_by_id?: string;
  /** If set, create a work activity of this type after the job is created (work_version_id + user from context). */
  activity_type?: string;
  /** Optional payload stored on Activity.data. For CHECK_STARTED supply { check: { kind: '<service-id>' } }. */
  activity_data?: Record<string, unknown>;
};

export type UpdateJob = {
  status: JobStatus;
  message?: string;
  results?: Record<string, any>;
};

/** When parent completes successfully (`SUCCESS`) or unsuccessfully (`FAILURE`, including parent `CANCELLED`). */
export type JobTriggerOn = 'success' | 'failure';

export type DependentJobSpec = {
  job_id: string;
  job_type: string;
  payload: Record<string, unknown>;
  trigger_on: JobTriggerOn;
  activity_type?: string;
  activity_data?: Record<string, unknown>;
};

export type EnqueueJobParams = {
  job_id: string;
  job_type: string;
  payload: Record<string, unknown>;
  invoked_by_id?: string;
  activity_type?: string;
  activity_data?: Record<string, unknown>;
  /** When set in the future, job is inserted SCHEDULED and not dispatched until promoted. */
  scheduled_at?: string;
  /** Initial results (e.g. CLI_CHECK check report at POST). */
  results?: Record<string, unknown>;
  dependents?: DependentJobSpec[];
};

export type EnqueueJobResult = {
  job_id: string;
  job_type: string;
  status: 'DISPATCHED' | 'SCHEDULED';
  dependent_job_ids?: string[];
};
