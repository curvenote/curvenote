import {
  processJobMessage,
  registerExtensionJobs,
  MAX_JOB_QUEUE_DELIVERY_ATTEMPTS,
  type JobQueueDeliveryMetadata,
  type JobQueueMessage,
} from '@curvenote/scms-server';
import { extensions } from '../extensions/server';

/** Shared handler body for production (api/) and dev mock loopback routes. */
export async function consumeJobQueueMessage(
  message: JobQueueMessage,
  metadata: JobQueueDeliveryMetadata,
): Promise<void> {
  const extensionJobs = registerExtensionJobs(extensions);
  await processJobMessage(message, metadata, { extensionJobs });
}

/** Retry / visibility settings for @vercel/queue push consumers. */
export const jobQueueConsumerCallbackOptions = {
  visibilityTimeoutSeconds: 300,
  retry: (_error: unknown, metadata: { deliveryCount: number }) => {
    if (metadata.deliveryCount > MAX_JOB_QUEUE_DELIVERY_ATTEMPTS) {
      return { acknowledge: true as const };
    }
    return { afterSeconds: 60 };
  },
};
