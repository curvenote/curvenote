import { getJobQueueProvider } from './queueProviders/index.server.js';
import type { JobQueueMessage } from './queueProviders/types.js';

export async function dispatchJob(message: JobQueueMessage) {
  const provider = getJobQueueProvider();
  return provider.send(message, { idempotencyKey: message.job_id });
}
