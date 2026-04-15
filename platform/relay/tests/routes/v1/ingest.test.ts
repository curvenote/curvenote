// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect, beforeEach } from 'vitest';
import echoPlugin from '@curvenote/check-relay-plugin-echo';
import { app } from '../../../app/app.js';
import { registry } from '../../../app/plugins/registry.js';
import { makeTestPlugin } from '../../../app/test-plugin.js';

describe('POST /api/v1/ingest', () => {
  beforeEach(() => {
    registry.clear();
    registry.register(echoPlugin);
  });

  it('returns 401 for echo service instances via signature failure path', async () => {
    const res = await app.request('/api/v1/ingest/echo-fixture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalId: 'echo-1',
        notifyUrl: 'http://169.254.169.254/latest/meta-data/',
        step: 'complete',
      }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid webhook signature');
  });

  it('does not forward when plugin-recovered notifyUrl is outside allowlist', async () => {
    registry.clear();
    registry.register(
      makeTestPlugin('checker', {
        parseWebhook: async () => ({
          status: 'completed',
          externalId: 'ext-1',
          notifyUrl: 'https://evil.example.test/hooks/checks',
          clientId: 'client-1',
          result: {},
        }),
      }),
    );

    const res = await app.request('/api/v1/ingest/checker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'done' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ received: true, forwarded: false });
  });
});
