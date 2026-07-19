import { JobStatus } from '@curvenote/scms-db';
import { getPrismaClient } from '../../prisma.server.js';
import { dbUpdateJob } from '../handlers/db.server.js';
import type { HandleTransportFailureParams } from './transportFailureTypes.server.js';

/**
 * Mark a job FAILED after transport retries are exhausted or auth permanently fails.
 * Does not enqueue follow-up jobs — callers in enqueue/ handle that when needed.
 */
export async function terminalizeTransportFailure(
  jobId: string,
  params: Pick<HandleTransportFailureParams, 'reason' | 'last_error'>,
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
}
