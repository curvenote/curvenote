import type { JobQueueDeliveryMetadata, JobQueueMessage } from './pgmq/types.js';
import { ackJobMessage, getJobQueueDepth, readOneJobMessage } from './pgmq/jobQueue.server.js';
import { MAX_JOB_QUEUE_DELIVERY_ATTEMPTS } from '../jobQueueConstants.server.js';
import { handleTransportFailure } from '../run/handleTransportFailure.server.js';
import { notifyQueueConsumer } from './notifyQueueConsumer.server.js';

export type DrainJobConsumer = (
  message: JobQueueMessage,
  metadata: JobQueueDeliveryMetadata,
) => Promise<void>;

/**
 * Read and process one queue message (qty=1), then chain another wake if backlog remains.
 *
 * On consumer failure the message is left leased; it becomes visible again after
 * the pgmq visibility timeout and is redelivered (read_ct increments). Once
 * read_ct exceeds the max attempts, `readOneJobMessage` dead-letters it.
 */
export async function drainOneJob(consume: DrainJobConsumer): Promise<boolean> {
  const entry = await readOneJobMessage(async ({ message }) => {
    await handleTransportFailure(message.job_id, {
      reason: 'transport_exhausted',
      source: 'dead_letter',
      last_error: `Job dispatch failed after ${MAX_JOB_QUEUE_DELIVERY_ATTEMPTS} delivery attempts`,
    });
  });
  if (!entry) {
    return false;
  }

  await consume(entry.message, entry.metadata);
  await ackJobMessage(entry.msgId);

  const remaining = await getJobQueueDepth();
  if (remaining > 0) {
    notifyQueueConsumer();
  }

  return true;
}
