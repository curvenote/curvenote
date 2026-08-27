// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Response } from 'express';
import { scmsRequest } from './utils.js';

function mockRes(): Response {
  return {
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('scmsRequest', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('resolves when the API returns 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 200, statusText: 'OK' });
    const res = mockRes();

    await expect(
      scmsRequest({
        method: 'PUT',
        url: 'https://example.com/v1/status',
        body: { status: 'DEPOSITED' },
        authToken: 'token',
        res,
        contextLabel: 'putting status',
      }),
    ).resolves.toBeUndefined();

    expect(res.send).not.toHaveBeenCalled();
  });

  it('throws on non-200 and does not mark the job callback as successful for the caller', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 404, statusText: 'Not Found' });
    const res = mockRes();

    await expect(
      scmsRequest({
        method: 'PUT',
        url: 'https://example.com/v1/status',
        body: { status: 'DEPOSITED' },
        authToken: 'token',
        res,
        contextLabel: 'putting status',
      }),
    ).rejects.toThrow(/Bad response putting status: 404/);

    // Must not send a Pub/Sub success ack here — the caller/wrapper owns the response lifecycle
    expect(res.send).not.toHaveBeenCalled();
  });

  it('throws on network failure without sending a response', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'));
    const res = mockRes();

    await expect(
      scmsRequest({
        method: 'PATCH',
        url: 'https://example.com/v1/jobs/1',
        body: { status: 'COMPLETED' },
        authToken: 'token',
        res,
        contextLabel: 'patching job',
      }),
    ).rejects.toThrow(/Error patching job: connect ECONNREFUSED/);

    expect(res.send).not.toHaveBeenCalled();
  });
});
