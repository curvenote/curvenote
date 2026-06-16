/* eslint-disable import/no-extraneous-dependencies */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JobQueueDeliveryMetadata, JobQueueMessage } from '@curvenote/scms-server';

const LOCAL_MOCK_QUEUE_HEADER = 'x-local-mock-queue';

const {
  processJobMessage,
  registerExtensionJobs,
  isLocalMockQueueDeliveryEnabled,
  vercelPushHandler,
} = vi.hoisted(() => ({
  processJobMessage: vi.fn(),
  registerExtensionJobs: vi.fn(() => [{ jobType: 'TEST_JOB' }]),
  isLocalMockQueueDeliveryEnabled: vi.fn(() => true),
  vercelPushHandler: vi.fn(async () => Response.json({ handler: 'vercel' })),
}));

vi.mock('@curvenote/scms-server', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    processJobMessage,
    registerExtensionJobs,
    isLocalMockQueueDeliveryEnabled,
  };
});

vi.mock('@vercel/queue', () => ({
  handleCallback: () => vercelPushHandler,
}));

vi.mock('../../../extensions/server', () => ({
  extensions: [],
}));

const { action } = await import('./route');

function createMockRequest(
  body: { message: JobQueueMessage; metadata: JobQueueDeliveryMetadata },
  headers: Record<string, string> = {},
): Request {
  return new Request('http://localhost/v1/jobs/vercel-push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('vercel-push action', () => {
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
    processJobMessage.mockResolvedValue(undefined);
  });

  it('processes local mock queue delivery when provider and header match', async () => {
    const request = createMockRequest({ message, metadata }, { [LOCAL_MOCK_QUEUE_HEADER]: '1' });

    const response = await action({ request } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'success' });
    expect(registerExtensionJobs).toHaveBeenCalledTimes(1);
    expect(processJobMessage).toHaveBeenCalledWith(message, metadata, {
      extensionJobs: [{ jobType: 'TEST_JOB' }],
    });
    expect(vercelPushHandler).not.toHaveBeenCalled();
  });

  it('falls through to vercelPushHandler when local mock header is missing', async () => {
    const request = createMockRequest({ message, metadata });

    const response = await action({ request } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ handler: 'vercel' });
    expect(processJobMessage).not.toHaveBeenCalled();
    expect(vercelPushHandler).toHaveBeenCalledWith(request);
  });

  it('falls through to vercelPushHandler when mock queue delivery is disabled', async () => {
    isLocalMockQueueDeliveryEnabled.mockReturnValue(false);
    const request = createMockRequest({ message, metadata }, { [LOCAL_MOCK_QUEUE_HEADER]: '1' });

    const response = await action({ request } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ handler: 'vercel' });
    expect(processJobMessage).not.toHaveBeenCalled();
    expect(vercelPushHandler).toHaveBeenCalledWith(request);
  });

  it('returns 500 when local mock delivery processing fails', async () => {
    processJobMessage.mockRejectedValue(new Error('handler failed'));
    const request = createMockRequest({ message, metadata }, { [LOCAL_MOCK_QUEUE_HEADER]: '1' });

    const response = await action({ request } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Failed to process queue message' });
  });
});
