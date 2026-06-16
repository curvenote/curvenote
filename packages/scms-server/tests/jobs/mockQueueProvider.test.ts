/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  resetMockQueueState,
  mockQueueProvider,
  resolveMockQueueConsumerUrl,
  LOCAL_MOCK_QUEUE_HEADER,
} from '../../src/backend/jobs/enqueue/queueProviders/mock.server.js';

describe('mockQueueProvider', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetMockQueueState();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 'success' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    process.env.MOCK_QUEUE_CONSUMER_URL = 'http://localhost:3031/v1/jobs/vercel-push';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.MOCK_QUEUE_CONSUMER_URL;
  });

  test('returns a messageId and dedupes on idempotencyKey', async () => {
    const message = {
      job_id: 'job-1',
      job_type: 'LOOPBACK',
      handshake: 'token',
    };

    const first = await mockQueueProvider.send(message, { idempotencyKey: 'job-1' });
    const second = await mockQueueProvider.send(message, { idempotencyKey: 'job-1' });

    expect(first.messageId).toBeTruthy();
    expect(second.messageId).toMatch(/^mock-dedupe-/);
  });

  test('POSTs to the vercel-push consumer route with local mock header', async () => {
    const message = {
      job_id: 'job-2',
      job_type: 'PROOFIG_SUBMIT_STREAM',
      handshake: 'token',
    };

    await mockQueueProvider.send(message, { idempotencyKey: 'job-2' });
    await new Promise((resolve) => setImmediate(resolve));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(resolveMockQueueConsumerUrl());
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      [LOCAL_MOCK_QUEUE_HEADER]: '1',
    });
    const body = JSON.parse(String(init.body));
    expect(body.message).toEqual(message);
    expect(body.metadata).toMatchObject({ deliveryCount: 1 });
    expect(body.metadata.messageId).toEqual(expect.any(String));
  });
});
