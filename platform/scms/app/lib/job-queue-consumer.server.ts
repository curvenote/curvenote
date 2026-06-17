import {
  processJobMessage,
  registerExtensionJobs,
  type JobQueueDeliveryMetadata,
  type JobQueueMessage,
} from '@curvenote/scms-server';
import { extensions } from '../extensions/server';

/** Shared handler body for push-to-drain route. */
export async function consumeJobQueueMessage(
  message: JobQueueMessage,
  metadata: JobQueueDeliveryMetadata,
): Promise<void> {
  const extensionJobs = registerExtensionJobs(extensions);
  await processJobMessage(message, metadata, { extensionJobs });
}
