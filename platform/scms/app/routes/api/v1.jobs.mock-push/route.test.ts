/* eslint-disable import/no-extraneous-dependencies */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JobQueueDeliveryMetadata, JobQueueMessage } from '@curvenote/scms-server';

const LOCAL_MOCK_QUEUE_HEADER = 'x-local-mock-queue';

const { consumeJobQueueMessage, isLocalMockQueueDeliveryEnabled } = vi.hoisted(() => ({
  consumeJobQueueMessage: vi.fn(),
  isLocalMockQueueDeliveryEnabled: vi.fn(() => true),
}));

vi.mock('../../../lib/job-queue-consumer.server', () => ({
  consumeJobQueueMessage,
}));

vi.mock('@curvenote/scms-server', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    isLocalMockQueueDeliveryEnabled,
  };
});

const { action } = await import('./route');

function createMockRequest(
  body: { message: JobQueueMessage; metadata: JobQueueDeliveryMetadata },
  headers: Record<string, string> = {},
): Request {
  return new Request('http://localhost/v1/jobs/mock-push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('mock-push action', () => {
  const message: JobQueueMessage = {
    job_id: 'job-1',
    job_type: 'LOOPBACK',
    handshake: 'token',
  };
  const metadata: JobQueueDeliveryMetadata = {
    deliveryCount: 1,
    messageId: 'msg-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    isLocalMockQueueDeliveryEnabled.mockReturnValue(true);
    consumeJobQueueMessage.mockResolvedValue(undefined);
  });

  it('processes local mock queue delivery when provider and header match', async () => {
    const request = createMockRequest({ message, metadata }, { [LOCAL_MOCK_QUEUE_HEADER]: '1' });

    const response = await action({ request } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'success' });
    expect(consumeJobQueueMessage).toHaveBeenCalledWith(message, metadata);
  });

  it('returns 400 when local mock header is missing', async () => {
    const request = createMockRequest({ message, metadata });

    const response = await action({ request } as never);

    expect(response.status).toBe(400);
    expect(consumeJobQueueMessage).not.toHaveBeenCalled();
  });

  it('returns 404 when mock queue delivery is disabled', async () => {
    isLocalMockQueueDeliveryEnabled.mockReturnValue(false);
    const request = createMockRequest({ message, metadata }, { [LOCAL_MOCK_QUEUE_HEADER]: '1' });

    const response = await action({ request } as never);

    expect(response.status).toBe(404);
    expect(consumeJobQueueMessage).not.toHaveBeenCalled();
  });

  it('returns 500 when local mock delivery processing fails', async () => {
    consumeJobQueueMessage.mockRejectedValue(new Error('handler failed'));
    const request = createMockRequest({ message, metadata }, { [LOCAL_MOCK_QUEUE_HEADER]: '1' });

    const response = await action({ request } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Failed to process queue message' });
  });
});
