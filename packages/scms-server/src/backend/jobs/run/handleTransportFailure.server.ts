import { JobStatus } from '@curvenote/scms-db';
import { getPrismaClient } from '../../prisma.server.js';
import type { HandleTransportFailureParams } from './transportFailureTypes.server.js';
import { terminalizeTransportFailure } from './terminalizeTransportFailure.server.js';

export type {
  HandleTransportFailureParams,
  TransportFailureReason,
} from './transportFailureTypes.server.js';

/**
 * Terminalize a job after transport retries are exhausted or auth permanently fails.
 * Enqueues JOB_FAILED_DEFAULT for visibility when appropriate.
 */
export async function handleTransportFailure(
  jobId: string,
  params: HandleTransportFailureParams,
): Promise<void> {
  await terminalizeTransportFailure(jobId, params);

  const { enqueueJobFailedDefault } = await import('../enqueue/enqueueJobFailedDefault.server.js');
  await enqueueJobFailedDefault(jobId, params);

  // The normal runHandler completion path calls onJobTerminal to resolve BLOCKED
  // dependents; a job that fails via transport/dead-letter never reaches that
  // path, so it must be called here too or dependents stay BLOCKED forever.
  const prisma = await getPrismaClient();
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (
    job &&
    (job.status === JobStatus.COMPLETED ||
      job.status === JobStatus.FAILED ||
      job.status === JobStatus.CANCELLED)
  ) {
    const { onJobTerminal } = await import('./onJobTerminal.server.js');
    // enqueueJobFailedDefault above already covers this failure's visibility job.
    await onJobTerminal(jobId, job.status, { skipFailedDefault: true });
  }
}
