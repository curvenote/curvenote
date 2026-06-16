import { error405 } from '@curvenote/scms-core';
import {
  isLocalMockQueueDeliveryEnabled,
  LOCAL_MOCK_QUEUE_HEADER,
  type JobQueueDeliveryMetadata,
  type JobQueueMessage,
} from '@curvenote/scms-server';
import { consumeJobQueueMessage } from '../../../lib/job-queue-consumer.server';
import type { Route } from './+types/route';

export const config = {
  maxDuration: 300,
};

export function loader() {
  throw error405();
}

/**
 * POST /v1/jobs/mock-push — **development and tests only**
 *
 * The in-process mock queue provider (`QUEUES_PROVIDER=mock`) POSTs here with
 * `x-local-mock-queue: 1` so handlers run locally without Vercel Queues.
 *
 * Production/preview on Vercel uses `api/v1/jobs/vercel-push.ts` (queue trigger), not this route.
 */
export async function action(args: Route.ActionArgs) {
  if (!isLocalMockQueueDeliveryEnabled()) {
    return Response.json(
      { error: 'Mock queue consumer is only available when QUEUES_PROVIDER=mock.' },
      { status: 404 },
    );
  }

  if (args.request.headers.get(LOCAL_MOCK_QUEUE_HEADER) !== '1') {
    return Response.json({ error: 'Missing x-local-mock-queue header.' }, { status: 400 });
  }

  try {
    const body = (await args.request.json()) as {
      message: JobQueueMessage;
      metadata: JobQueueDeliveryMetadata;
    };
    await consumeJobQueueMessage(body.message, body.metadata);
    return Response.json({ status: 'success' });
  } catch (error) {
    console.error('[mock-push] local mock delivery failed', error);
    return Response.json({ error: 'Failed to process queue message' }, { status: 500 });
  }
}
