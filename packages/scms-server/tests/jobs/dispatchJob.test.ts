/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { resetMockQueueState } from '../../src/backend/jobs/enqueue/queueProviders/mock.server.js';
import { resetJobQueueProviderCache } from '../../src/backend/jobs/enqueue/queueProviders/index.server.js';

vi.mock('@vercel/functions', () => ({
  waitUntil: (promise: Promise<unknown>) => promise,
}));

vi.mock('../../src/app-config.server.js', () => ({
  getConfig: vi.fn(async () => ({
    api: {
      url: 'http://localhost:3031',
      queueConsumerSecret: 'test-queue-secret',
    },
  })),
}));

const { dispatchJob } = await import('../../src/backend/jobs/enqueue/dispatchJob.server.js');

describe('dispatchJob', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetMockQueueState();
    resetJobQueueProviderCache();
    process.env.QUEUES_PROVIDER = 'mock';
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 'accepted' }), { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.QUEUES_PROVIDER;
  });

  test('enqueues and wakes push-to-drain with Bearer auth', async () => {
    const message = {
      job_id: 'job-1',
      job_type: 'LOOPBACK',
      handshake: 'token',
    };

    await dispatchJob(message);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3031/v1/jobs/push-to-drain');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer test-queue-secret',
      'Content-Type': 'application/json',
    });
  });
});
