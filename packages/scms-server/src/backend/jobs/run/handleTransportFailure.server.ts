import { JobStatus } from '@curvenote/scms-db';
import { KnownJobTypes } from '@curvenote/scms-core';
import { uuidv7 } from 'uuidv7';
import { getPrismaClient } from '../../prisma.server.js';
import { dbUpdateJob } from '../handlers/db.server.js';
import { enqueueAndDispatchJob } from '../enqueue/enqueueAndDispatchJob.server.js';

export type TransportFailureReason =
  | 'transport_exhausted'
  | 'invalid_handshake'
  | 'unknown_job_type';

export type HandleTransportFailureParams = {
  reason: TransportFailureReason | 'domain_failed' | 'stale_running';
  source: 'dead_letter' | 'on_failure_fallback';
  last_error?: string;
};

/**
 * Terminalize a job after transport retries are exhausted or auth permanently fails.
 * Enqueues JOB_FAILED_DEFAULT for visibility when appropriate.
 */
export async function handleTransportFailure(
  jobId: string,
  params: HandleTransportFailureParams,
): Promise<void> {
  const prisma = await getPrismaClient();
  const existing = await prisma.job.findUnique({ where: { id: jobId } });

  const message =
    params.last_error ??
    (params.reason === 'transport_exhausted'
      ? 'Job dispatch failed after maximum delivery attempts'
      : 'Job dispatch failed permanently');

  if (existing) {
    if (existing.status !== JobStatus.COMPLETED && existing.status !== JobStatus.FAILED) {
      await dbUpdateJob(jobId, {
        status: JobStatus.FAILED,
        message,
      });
    }
  }

  if (params.source === 'dead_letter' && existing?.job_type !== KnownJobTypes.JOB_FAILED_DEFAULT) {
    const cleanupJobId = uuidv7();
    await enqueueAndDispatchJob({
      job_id: cleanupJobId,
      job_type: KnownJobTypes.JOB_FAILED_DEFAULT,
      payload: {
        failed_job_id: jobId,
        failed_job_type: existing?.job_type ?? 'UNKNOWN',
        reason: params.reason,
        source: params.source,
        last_error: params.last_error,
      },
      invoked_by_id: existing?.invoked_by_id ?? undefined,
    });
  }
}
