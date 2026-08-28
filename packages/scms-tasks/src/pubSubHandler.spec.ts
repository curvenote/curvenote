// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';

const running = vi.fn();
const failed = vi.fn();

vi.mock('./client.js', () => ({
  SCMSClient: class {
    jobs = { running, failed, completed: vi.fn() };
    submissions = { putStatus: vi.fn() };
  },
}));

import { withPubSubHandler } from './pubSubHandler.js';

function mockRes(): Response & { headersSent: boolean } {
  const res = {
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockImplementation(function send(this: typeof res) {
      this.headersSent = true;
      return this;
    }),
  };
  return res as unknown as Response & { headersSent: boolean };
}

function pubSubReq(
  overrides?: Partial<{ attributes: Record<string, string>; data: string }>,
): Request {
  const attributes = {
    jobUrl: 'https://example.com/v1/jobs/1',
    handshake: 'hs-token',
    userId: 'user-1',
    failureState: 'FAILED',
    ...overrides?.attributes,
  };
  const data = Buffer.from(overrides?.data ?? JSON.stringify({ ok: true })).toString('base64');
  return {
    body: { message: { attributes, data } },
  } as Request;
}

describe('withPubSubHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    running.mockResolvedValue(undefined);
    failed.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('always sends a Pub/Sub ack when the handler and onFailure both throw', async () => {
    failed.mockRejectedValue(new Error('SCMS unreachable'));
    const onFailure = vi.fn().mockRejectedValue(new Error('putStatus 401'));
    const res = mockRes();

    const handler = withPubSubHandler(
      async () => {
        throw new Error('converter blew up');
      },
      { onFailure },
    );

    await handler(pubSubReq(), res);

    expect(onFailure).toHaveBeenCalled();
    expect(failed).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.headersSent).toBe(true);
  });

  it('does not double-send when jobs.failed already acked', async () => {
    failed.mockImplementation(async (res: Response & { headersSent: boolean }) => {
      res.headersSent = true;
      (res.send as ReturnType<typeof vi.fn>)();
      return res;
    });
    const res = mockRes();

    const handler = withPubSubHandler(async () => {
      throw new Error('converter blew up');
    });

    await handler(pubSubReq(), res);

    expect(res.send).toHaveBeenCalledTimes(1);
  });
});
