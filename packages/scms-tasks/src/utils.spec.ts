// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scmsRequest } from './utils.js';

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

    await expect(
      scmsRequest({
        method: 'PUT',
        url: 'https://example.com/v1/status',
        body: { status: 'DEPOSITED' },
        authToken: 'token',
        contextLabel: 'putting status',
      }),
    ).resolves.toBeUndefined();
  });

  it('throws on non-200 without wrapping as a network error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 404, statusText: 'Not Found' });

    await expect(
      scmsRequest({
        method: 'PUT',
        url: 'https://example.com/v1/status',
        body: { status: 'DEPOSITED' },
        authToken: 'token',
        contextLabel: 'putting status',
      }),
    ).rejects.toThrow(/^Bad response putting status: 404/);
  });

  it('throws on network failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(
      scmsRequest({
        method: 'PATCH',
        url: 'https://example.com/v1/jobs/1',
        body: { status: 'COMPLETED' },
        authToken: 'token',
        contextLabel: 'patching job',
      }),
    ).rejects.toThrow(/^Error patching job: connect ECONNREFUSED/);
  });
});
