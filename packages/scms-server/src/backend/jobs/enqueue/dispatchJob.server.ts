import { getJobQueueProvider } from './queueProviders/index.server.js';
import { notifyQueueConsumer } from './notifyQueueConsumer.server.js';
import type { JobQueueMessage } from './queueProviders/types.js';

export async function dispatchJob(message: JobQueueMessage) {
  const provider = getJobQueueProvider();
  const result = await provider.send(message, { idempotencyKey: message.job_id });
  await notifyQueueConsumer();
  return result;
}
