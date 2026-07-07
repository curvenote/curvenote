/* eslint-disable import/no-extraneous-dependencies */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createScopedHandshakeToken } from '@curvenote/scms-server';
import { CronEndpointScopes, cronEndpointScope } from '@curvenote/scms-core';

const ISSUER = 'https://scms.test/handshake';
const KEY = 'test-signing-secret';

vi.mock('@curvenote/scms-server', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    getConfig: vi.fn(async () => ({
      api: {
        handshakeIssuer: ISSUER,
        handshakeSigningSecret: KEY,
      },
    })),
  };
});

const { action, loader } = await import('./route');

function createRequest(method: string, auth?: string): Request {
  return new Request('http://localhost/v1/loopback', {
    method,
    headers: auth ? { Authorization: auth } : {},
  });
}

describe('loopback route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns loopback JSON for POST when scoped handshake is valid', async () => {
    const token = createScopedHandshakeToken(CronEndpointScopes.LOOPBACK, ISSUER, KEY);
    const response = await action({ request: createRequest('POST', `Bearer ${token}`) } as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toContain('loopback');
    expect(body.endpoint_scope).toBe(CronEndpointScopes.LOOPBACK);
    expect(body.version).toBeTruthy();
  });

  it('returns loopback JSON for GET when scoped handshake is valid', async () => {
    const scope = cronEndpointScope('GET', '/v1/loopback');
    const token = createScopedHandshakeToken(scope, ISSUER, KEY);
    const response = await loader({ request: createRequest('GET', `Bearer ${token}`) } as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toContain('loopback');
    expect(body.endpoint_scope).toBe(scope);
  });

  it('returns 401 when Authorization is missing or invalid', async () => {
    const missing = await action({ request: createRequest('POST') } as never);
    expect(missing.status).toBe(401);

    const wrong = await action({ request: createRequest('POST', 'Bearer not-a-token') } as never);
    expect(wrong.status).toBe(401);
  });
});
