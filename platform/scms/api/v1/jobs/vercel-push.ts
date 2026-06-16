/**
 * Production Vercel Queues consumer for topic `job`.
 *
 * Vercel only binds `experimentalTriggers` to files under project-root `api/` — not React Router
 * routes. Queue infrastructure invokes this function directly (private; not a public HTTP route).
 *
 * Local dev uses the mock queue provider → POST /v1/jobs/mock-push instead.
 */
import { QueueClient } from '@vercel/queue';
import type { JobQueueMessage } from '@curvenote/scms-server';
import {
  consumeJobQueueMessage,
  jobQueueConsumerCallbackOptions,
} from '../../../app/lib/job-queue-consumer.server.js';

const { handleNodeCallback } = new QueueClient();

export default handleNodeCallback(
  async (message, metadata) => {
    await consumeJobQueueMessage(message as JobQueueMessage, {
      deliveryCount: metadata.deliveryCount,
      messageId: metadata.messageId ?? '',
    });
  },
  jobQueueConsumerCallbackOptions,
);
