import { uuidv7 } from 'uuidv7';
import type {
  JobQueueDeliveryMetadata,
  JobQueueMessage,
  JobQueueProvider,
  JobQueueSendOptions,
  JobQueueSendResult,
} from './types.js';

/** Loopback header — mock queue POSTs to /v1/jobs/vercel-push with this set when provider is mock. */
export const LOCAL_MOCK_QUEUE_HEADER = 'x-local-mock-queue';

type MockQueueEntry = {
  message: JobQueueMessage;
  idempotencyKey: string;
  deliveryCount: number;
  messageId: string;
};

const dispatchedKeys = new Set<string>();
const queue: MockQueueEntry[] = [];
let processing = false;

export function resolveMockQueueConsumerUrl(): string {
  if (process.env.MOCK_QUEUE_CONSUMER_URL) {
    return process.env.MOCK_QUEUE_CONSUMER_URL;
  }
  const port = process.env.VITE_PORT ?? process.env.PORT ?? '3031';
  return `http://localhost:${port}/v1/jobs/vercel-push`;
}

async function postToConsumer(entry: MockQueueEntry): Promise<void> {
  const metadata: JobQueueDeliveryMetadata = {
    deliveryCount: entry.deliveryCount,
    messageId: entry.messageId,
  };

  const response = await fetch(resolveMockQueueConsumerUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [LOCAL_MOCK_QUEUE_HEADER]: '1',
    },
    body: JSON.stringify({ message: entry.message, metadata }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(
      `Mock queue consumer POST failed (${response.status}): ${errorText || 'unknown error'}`,
    );
  }
}

async function deliverEntry(entry: MockQueueEntry): Promise<void> {
  console.log('[mock-queue] delivering', {
    job_id: entry.message.job_id,
    job_type: entry.message.job_type,
    deliveryCount: entry.deliveryCount,
    messageId: entry.messageId,
    consumerUrl: resolveMockQueueConsumerUrl(),
  });

  try {
    await postToConsumer(entry);
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.warn('[mock-queue] delivery failed', {
      job_id: entry.message.job_id,
      deliveryCount: entry.deliveryCount,
      errMessage,
    });

    const { handleTransportFailure } = await import('../../run/handleTransportFailure.server.js');
    await handleTransportFailure(entry.message.job_id, {
      reason: 'domain_failed',
      source: 'dead_letter',
      last_error: errMessage,
    });
  }
}

async function drainQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    while (queue.length > 0) {
      const entry = queue.shift()!;
      await deliverEntry(entry);
    }
  } finally {
    processing = false;
  }
}

function scheduleDrain(): void {
  setImmediate(() => {
    void drainQueue();
  });
}

export const mockQueueProvider: JobQueueProvider = {
  async send(message: JobQueueMessage, options: JobQueueSendOptions): Promise<JobQueueSendResult> {
    if (dispatchedKeys.has(options.idempotencyKey)) {
      console.log('[mock-queue] skipping duplicate idempotencyKey', {
        job_id: message.job_id,
        idempotencyKey: options.idempotencyKey,
      });
      return { messageId: `mock-dedupe-${message.job_id}` };
    }

    dispatchedKeys.add(options.idempotencyKey);
    const messageId = uuidv7();
    queue.push({
      message,
      idempotencyKey: options.idempotencyKey,
      deliveryCount: 1,
      messageId,
    });
    scheduleDrain();
    return { messageId };
  },
};

/** Reset mock queue state — for tests only. */
export function resetMockQueueState(): void {
  dispatchedKeys.clear();
  queue.length = 0;
  processing = false;
}
