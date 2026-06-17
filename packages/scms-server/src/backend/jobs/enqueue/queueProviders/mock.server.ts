import { uuidv7 } from 'uuidv7';
import { MAX_JOB_QUEUE_DELIVERY_ATTEMPTS } from '../../jobQueueConstants.server.js';
import { terminalizeTransportFailure } from '../../run/terminalizeTransportFailure.server.js';
import type {
  JobQueueMessage,
  JobQueueProvider,
  JobQueueSendOptions,
  JobQueueSendResult,
  QueuePeekEntry,
  QueueReadReceipt,
  QueueReadResult,
} from './types.js';

const DEFAULT_RETRY_DELAY_MS = Number(process.env.MOCK_QUEUE_RETRY_DELAY_MS ?? 1000);

type MockQueueEntry = {
  message: JobQueueMessage;
  idempotencyKey: string;
  deliveryCount: number;
  messageId: string;
};

const dispatchedKeys = new Set<string>();
const queue: MockQueueEntry[] = [];
let drainInProgress = false;

export function resolveMockQueueDrainUrl(): string {
  if (process.env.MOCK_QUEUE_CONSUMER_URL) {
    return process.env.MOCK_QUEUE_CONSUMER_URL;
  }
  if (process.env.MOCK_QUEUE_DRAIN_URL) {
    return process.env.MOCK_QUEUE_DRAIN_URL;
  }
  const port = process.env.VITE_PORT ?? process.env.PORT ?? '3031';
  return `http://localhost:${port}/v1/jobs/push-to-drain`;
}

/** @deprecated Use resolveMockQueueDrainUrl */
export const resolveMockQueueConsumerUrl = resolveMockQueueDrainUrl;

function entryAtHead(): MockQueueEntry | undefined {
  return queue[0];
}

export const mockQueueProvider: JobQueueProvider = {
  // No database/pg_net locally — the app must self-wake push-to-drain on enqueue.
  wakesOnEnqueue: false,

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

    console.log('[mock-queue] enqueued', {
      job_id: message.job_id,
      job_type: message.job_type,
      messageId,
      depth: queue.length,
    });

    return { messageId };
  },

  async readOne(): Promise<QueueReadResult | null> {
    if (drainInProgress) {
      return null;
    }
    const entry = entryAtHead();
    if (!entry) {
      return null;
    }
    drainInProgress = true;
    return {
      message: entry.message,
      metadata: {
        deliveryCount: entry.deliveryCount,
        messageId: entry.messageId,
      },
      receipt: entry,
    };
  },

  async ack(receipt: QueueReadReceipt): Promise<void> {
    const entry = receipt as MockQueueEntry;
    const idx = queue.indexOf(entry);
    if (idx >= 0) {
      queue.splice(idx, 1);
    }
    drainInProgress = false;
  },

  async nack(receipt: QueueReadReceipt): Promise<void> {
    const entry = receipt as MockQueueEntry;
    drainInProgress = false;

    if (entry.deliveryCount >= MAX_JOB_QUEUE_DELIVERY_ATTEMPTS) {
      const idx = queue.indexOf(entry);
      if (idx >= 0) {
        queue.splice(idx, 1);
      }
      await terminalizeTransportFailure(entry.message.job_id, {
        reason: 'transport_exhausted',
        last_error: 'Mock queue delivery retries exhausted',
      });
      return;
    }

    entry.deliveryCount += 1;
    setTimeout(() => {
      void import('../notifyQueueConsumer.server.js').then(({ notifyQueueConsumer }) =>
        notifyQueueConsumer(),
      );
    }, DEFAULT_RETRY_DELAY_MS);
  },

  async getDepth(): Promise<number> {
    return queue.length;
  },

  async peek(limit: number): Promise<QueuePeekEntry[]> {
    const head = entryAtHead();
    // Most recent first; the head is in-flight while a drain is running.
    return queue
      .slice(-limit)
      .reverse()
      .map((entry) => ({
        messageId: entry.messageId,
        jobId: entry.message.job_id,
        jobType: entry.message.job_type,
        deliveryCount: entry.deliveryCount,
        enqueuedAt: null,
        visibleAt: null,
        inFlight: drainInProgress && entry === head,
      }));
  },
};

/** Reset mock queue state — for tests only. */
export function resetMockQueueState(): void {
  dispatchedKeys.clear();
  queue.length = 0;
  drainInProgress = false;
}
