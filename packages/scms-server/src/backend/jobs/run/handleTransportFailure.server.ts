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
}
