import { describe, expect, it } from 'vitest';
import {
  createHandshakeToken,
  createScopedHandshakeToken,
} from '../../src/backend/sign.handshake.server.js';
import {
  CronEndpointScopes,
  assertEndpointScope,
  cronEndpointScope,
  verifyEndpointScopedHandshake,
} from '../../src/backend/cron/scopes.js';

const ISSUER = 'https://scms.test/handshake';
const KEY = 'test-signing-secret';

describe('cronEndpointScope', () => {
  it('builds METHOD:path from method and pathname', () => {
    expect(cronEndpointScope('post', '/v1/jobs/push-to-drain')).toBe(
      CronEndpointScopes.JOB_QUEUE_DRAIN,
    );
    expect(cronEndpointScope('GET', 'v1/cron/tick')).toBe('GET:/v1/cron/tick');
  });
});

describe('verifyEndpointScopedHandshake', () => {
  it('accepts a scoped token for the expected endpoint', () => {
    const token = createScopedHandshakeToken(
      CronEndpointScopes.PROMOTE_SCHEDULED,
      ISSUER,
      KEY,
    );
    const config = {
      api: { handshakeIssuer: ISSUER, handshakeSigningSecret: KEY },
    } as Parameters<typeof verifyEndpointScopedHandshake>[1];

    const claims = verifyEndpointScopedHandshake(
      `Bearer ${token}`,
      config,
      CronEndpointScopes.PROMOTE_SCHEDULED,
    );
    expect(claims.endpoint_scope).toBe(CronEndpointScopes.PROMOTE_SCHEDULED);
    expect(claims.aud).toBeUndefined();
    expect(claims.jobId).toBeUndefined();
  });

  it('rejects a job token (no endpoint_scope)', () => {
    const token = createHandshakeToken('job-1', 'TEXT_INTEGRITY_SUBMIT', ISSUER, KEY);
    const config = {
      api: { handshakeIssuer: ISSUER, handshakeSigningSecret: KEY },
    } as Parameters<typeof verifyEndpointScopedHandshake>[1];

    expect(() =>
      verifyEndpointScopedHandshake(
        `Bearer ${token}`,
        config,
        CronEndpointScopes.PROMOTE_SCHEDULED,
      ),
    ).toThrow();
  });

  it('rejects a scoped token for the wrong endpoint', () => {
    const token = createScopedHandshakeToken(CronEndpointScopes.JOB_QUEUE_DRAIN, ISSUER, KEY);
    const config = {
      api: { handshakeIssuer: ISSUER, handshakeSigningSecret: KEY },
    } as Parameters<typeof verifyEndpointScopedHandshake>[1];

    expect(() =>
      verifyEndpointScopedHandshake(
        `Bearer ${token}`,
        config,
        CronEndpointScopes.PROMOTE_SCHEDULED,
      ),
    ).toThrow();
  });
});

describe('assertEndpointScope', () => {
  it('throws when endpoint_scope does not match', () => {
    expect(() => assertEndpointScope({ endpoint_scope: 'POST:/other' }, 'POST:/expected')).toThrow();
  });
});
