/* eslint-disable import/no-extraneous-dependencies */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JobQueueDeliveryMetadata, JobQueueMessage } from '@curvenote/scms-server';

const { consumeJobQueueMessage, drainOneJob } = vi.hoisted(() => ({
  consumeJobQueueMessage: vi.fn(),
  drainOneJob: vi.fn(async (consume: typeof consumeJobQueueMessage) => {
    await consume(
      { job_id: 'job-1', job_type: 'LOOPBACK', handshake: 'token' },
      { deliveryCount: 1, messageId: 'msg-1' },
    );
  }),
}));

const { isJobQueueDrainPaused } = vi.hoisted(() => ({
  isJobQueueDrainPaused: vi.fn(async () => false),
}));

vi.mock('../../../lib/job-queue-consumer.server', () => ({
  consumeJobQueueMessage,
}));

vi.mock('@curvenote/scms-server', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    drainOneJob,
    isJobQueueDrainPaused,
    getConfig: vi.fn(async () => ({
      api: { queueConsumerSecret: 'test-secret' },
    })),
  };
});

vi.mock('@vercel/functions', () => ({
  waitUntil: (promise: Promise<unknown>) => promise,
}));

const { action } = await import('./route');

function createRequest(auth?: string): Request {
  return new Request('http://localhost/v1/jobs/push-to-drain', {
    method: 'POST',
    headers: auth ? { Authorization: auth } : {},
    body: '{}',
  });
}

describe('push-to-drain action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isJobQueueDrainPaused.mockResolvedValue(false);
    drainOneJob.mockImplementation(async (consume) => {
      await consume(
        { job_id: 'job-1', job_type: 'LOOPBACK', handshake: 'token' } satisfies JobQueueMessage,
        { deliveryCount: 1, messageId: 'msg-1' } satisfies JobQueueDeliveryMetadata,
      );
    });
  });

  it('returns 202 and drains one job when authorized', async () => {
    const response = await action({ request: createRequest('Bearer test-secret') } as never);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ status: 'accepted' });
    expect(drainOneJob).toHaveBeenCalledWith(consumeJobQueueMessage);
  });

  it('returns 202 without draining when the queue is paused', async () => {
    isJobQueueDrainPaused.mockResolvedValue(true);

    const response = await action({ request: createRequest('Bearer test-secret') } as never);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ status: 'accepted', paused: true });
    expect(drainOneJob).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization is missing or wrong', async () => {
    const missing = await action({ request: createRequest() } as never);
    expect(missing.status).toBe(401);

    const wrong = await action({ request: createRequest('Bearer wrong') } as never);
    expect(wrong.status).toBe(401);
    expect(drainOneJob).not.toHaveBeenCalled();
  });
});
