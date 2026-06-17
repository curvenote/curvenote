import type { JobQueueDeliveryMetadata, JobQueueMessage } from './queueProviders/types.js';
import { getJobQueueProvider } from './queueProviders/index.server.js';
import { notifyQueueConsumer } from './notifyQueueConsumer.server.js';

export type DrainJobConsumer = (
  message: JobQueueMessage,
  metadata: JobQueueDeliveryMetadata,
) => Promise<void>;

/**
 * Read and process one queue message (qty=1), then chain another wake if backlog remains.
 */
export async function drainOneJob(consume: DrainJobConsumer): Promise<boolean> {
  const provider = getJobQueueProvider();
  const entry = await provider.readOne();
  if (!entry) {
    return false;
  }

  try {
    await consume(entry.message, entry.metadata);
    await provider.ack(entry.receipt);
  } catch (err) {
    await provider.nack(entry.receipt);
    throw err;
  }

  const remaining = await provider.getDepth();
  if (remaining > 0) {
    notifyQueueConsumer();
  }

  return true;
}
