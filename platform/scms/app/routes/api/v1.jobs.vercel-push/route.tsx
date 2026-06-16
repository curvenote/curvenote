import { handleCallback } from '@vercel/queue';
import { error405 } from '@curvenote/scms-core';
import {
  isLocalMockQueueDeliveryEnabled,
  LOCAL_MOCK_QUEUE_HEADER,
  processJobMessage,
  registerExtensionJobs,
  MAX_JOB_QUEUE_DELIVERY_ATTEMPTS,
  type JobQueueDeliveryMetadata,
  type JobQueueMessage,
} from '@curvenote/scms-server';
import { extensions } from '../../../extensions/server';
import type { Route } from './+types/route';

export const config = {
  maxDuration: 300,
};

export function loader() {
  throw error405();
}

/**
 * Shared consumer logic for Vercel push delivery and local mock queue loopback.
 */
export async function consumeJobQueueMessage(
  message: JobQueueMessage,
  metadata: JobQueueDeliveryMetadata,
): Promise<void> {
  const extensionJobs = registerExtensionJobs(extensions);
  await processJobMessage(message, metadata, { extensionJobs });
}

const vercelPushHandler = handleCallback(
  async (message, metadata) => {
    await consumeJobQueueMessage(message as JobQueueMessage, {
      deliveryCount: metadata.deliveryCount,
      messageId: metadata.messageId ?? '',
    });
  },
  {
    visibilityTimeoutSeconds: 300,
    retry: (_error, metadata) => {
      if (metadata.deliveryCount > MAX_JOB_QUEUE_DELIVERY_ATTEMPTS) {
        return { acknowledge: true };
      }
      return { afterSeconds: 60 };
    },
  },
);

/**
 * POST /v1/jobs/vercel-push
 *
 * Vercel Queues push consumer for topic `job`.
 * When the mock queue provider is active, it POSTs here with `x-local-mock-queue: 1`
 * so delivery uses the same route and extension registration as production.
 */
export async function action(args: Route.ActionArgs) {
  if (
    isLocalMockQueueDeliveryEnabled() &&
    args.request.headers.get(LOCAL_MOCK_QUEUE_HEADER) === '1'
  ) {
    try {
      const body = (await args.request.json()) as {
        message: JobQueueMessage;
        metadata: JobQueueDeliveryMetadata;
      };
      await consumeJobQueueMessage(body.message, body.metadata);
      return Response.json({ status: 'success' });
    } catch (error) {
      console.error('[vercel-push] local mock delivery failed', error);
      return Response.json({ error: 'Failed to process queue message' }, { status: 500 });
    }
  }

  return vercelPushHandler(args.request);
}
