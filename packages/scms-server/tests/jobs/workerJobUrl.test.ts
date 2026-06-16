import { describe, expect, it, vi } from 'vitest';
import { hooksNotifyBaseUrl, workerJobUrl } from '../../src/backend/jobs/workerJobUrl.server.js';
import type { Context } from '../../src/backend/context.server.js';

function makeCtx(options?: { tasksCallbackUrl?: string; apiUrl?: string }): Context {
  return {
    request: new Request('http://localhost/internal/jobs/run', { method: 'POST' }),
    asApiUrl: vi.fn((path: string) => `http://localhost/v1${path}`),
    $config: {
      api: {
        tasksCallbackUrl: options?.tasksCallbackUrl,
        url: options?.apiUrl,
      },
    },
  } as unknown as Context;
}

describe('workerJobUrl', () => {
  it('uses request-derived URL when tasksCallbackUrl is unset', () => {
    const ctx = makeCtx();
    expect(workerJobUrl(ctx, '/jobs/abc')).toBe('http://localhost/v1/jobs/abc');
    expect(ctx.asApiUrl).toHaveBeenCalledWith('/jobs/abc');
  });

  it('uses tasksCallbackUrl when configured', () => {
    const ctx = makeCtx({ tasksCallbackUrl: 'http://host.docker.internal:3031/v1' });
    expect(workerJobUrl(ctx, '/jobs/abc')).toBe('http://host.docker.internal:3031/v1/jobs/abc');
    expect(ctx.asApiUrl).not.toHaveBeenCalled();
  });

  it('normalizes trailing slash on tasksCallbackUrl', () => {
    const ctx = makeCtx({ tasksCallbackUrl: 'http://host.docker.internal:3031/v1/' });
    expect(workerJobUrl(ctx, '/jobs/abc')).toBe('http://host.docker.internal:3031/v1/jobs/abc');
  });
});

describe('hooksNotifyBaseUrl', () => {
  it('returns configured notifyBaseUrl without trailing slash', () => {
    expect(
      hooksNotifyBaseUrl(
        'text-integrity/notify',
        'https://example.com/v1/hooks/text-integrity/notify/',
      ),
    ).toBe('https://example.com/v1/hooks/text-integrity/notify');
  });

  it('throws when notifyBaseUrl is missing or blank', async () => {
    for (const value of [undefined, '   '] as const) {
      try {
        hooksNotifyBaseUrl('text-integrity/notify', value);
        expect.unreachable('expected hooksNotifyBaseUrl to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(Response);
        const res = err as Response;
        expect(res.status).toBe(503);
        const body = (await res.json()) as { message?: string };
        expect(body.message).toContain('Extension notifyBaseUrl is required for hook text-integrity/notify');
      }
    }
  });
});
