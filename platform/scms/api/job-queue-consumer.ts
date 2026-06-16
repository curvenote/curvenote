/**
 * Production Vercel Queues push consumer for topic `job`.
 *
 * Must be a flat file under project-root `api/` (nested api/v1/... is not
 * detected with the React Router framework preset).
 *
 * deploy-curvenote prebuilds locally with the curvenote submodule checked out,
 * so this file is present when `vercel build` validates `functions` patterns.
 *
 * Local dev uses POST /v1/jobs/mock-push via the mock queue provider instead.
 */
import { handleCallback } from '@vercel/queue';
import type { JobQueueMessage } from '@curvenote/scms-server';
import {
  consumeJobQueueMessage,
  jobQueueConsumerCallbackOptions,
} from '../app/lib/job-queue-consumer.server.js';

export const config = {
  useWebApi: true,
  maxDuration: 300,
};

export default handleCallback(async (message, metadata) => {
  await consumeJobQueueMessage(message as JobQueueMessage, {
    deliveryCount: metadata.deliveryCount,
    messageId: metadata.messageId ?? '',
  });
}, jobQueueConsumerCallbackOptions);
