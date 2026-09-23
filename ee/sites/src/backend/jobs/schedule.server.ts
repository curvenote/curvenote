import { uuidv7 } from 'uuidv7';
import type { KnownJobTypes } from '@curvenote/scms-core';
import { dispatchJobWithHandshake, ensureJobRow } from '@curvenote/scms-server';
import type { DoiTx } from '../doi/types.js';

export type CrossrefJobType =
  typeof KnownJobTypes.CROSSREF_DEPOSIT | typeof KnownJobTypes.CROSSREF_POLL;
export type CrossrefJobPayload = { depositId: string; siteId: string; attempt: number };

export type InsertJobParams = {
  jobType: CrossrefJobType;
  payload: CrossrefJobPayload;
  /** ISO time; in the future the row is SCHEDULED and the per-minute sweep dispatches it. */
  scheduledAt?: string;
  invokedById?: string;
};

/**
 * The job row goes into the caller's transaction so `DoiDeposit.job_id` and the row commit
 * together (CN-2518 rule). `enqueueAndDispatchJob` opens its own transaction, so it is not used.
 * An immediate job is dispatched by the caller after commit with `dispatchJob`.
 */
export async function insertJobRow(
  tx: DoiTx,
  params: InsertJobParams,
): Promise<{ jobId: string; scheduled: boolean }> {
  const jobId = uuidv7();
  const scheduled = Boolean(params.scheduledAt && params.scheduledAt > new Date().toISOString());
  await ensureJobRow(
    {
      job_id: jobId,
      job_type: params.jobType,
      payload: params.payload,
      invoked_by_id: params.invokedById,
      scheduled_at: scheduled ? params.scheduledAt : undefined,
    },
    scheduled ? 'SCHEDULED' : 'QUEUED',
    tx,
  );
  return { jobId, scheduled };
}

export async function dispatchJob(jobId: string, jobType: string): Promise<void> {
  await dispatchJobWithHandshake({ id: jobId, job_type: jobType });
}
