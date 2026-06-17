import { getJobQueueProvider } from './queueProviders/index.server.js';
import { notifyQueueConsumer } from './notifyQueueConsumer.server.js';
import type { JobQueueMessage } from './queueProviders/types.js';

export async function dispatchJob(message: JobQueueMessage) {
  const provider = getJobQueueProvider();
  const result = await provider.send(message, { idempotencyKey: message.job_id });
  // When the provider wakes the consumer on enqueue itself (e.g. supabase's
  // pg_net trigger on pgmq.q_job), skip the redundant app-side self-HTTP wake.
  if (!provider.wakesOnEnqueue) {
    notifyQueueConsumer();
  }
  return result;
}
