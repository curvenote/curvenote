import { KnownJobTypes } from '@curvenote/scms-core';
import { uuidv7 } from 'uuidv7';
import { getPrismaClient } from '../../prisma.server.js';
import type { HandleTransportFailureParams } from '../run/transportFailureTypes.server.js';
import { enqueueAndDispatchJob } from './enqueueAndDispatchJob.server.js';

/**
 * Enqueue JOB_FAILED_DEFAULT for visibility after a terminal transport/dead-letter failure.
 */
export async function enqueueJobFailedDefault(
  jobId: string,
  params: HandleTransportFailureParams,
): Promise<void> {
  const prisma = await getPrismaClient();
  const existing = await prisma.job.findUnique({ where: { id: jobId } });

  if (params.source !== 'dead_letter' || existing?.job_type === KnownJobTypes.JOB_FAILED_DEFAULT) {
    return;
  }

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
