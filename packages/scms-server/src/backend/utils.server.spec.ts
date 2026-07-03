// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { buildSecretUrlConfigStatus, resolveApiPath } from './utils.server.js';

describe('resolveApiPath', () => {
  it('strips trailing slashes and a /v1 suffix, then appends the path', () => {
    expect(resolveApiPath('http://localhost:3031/v1', '/v1/cron/tick')).toBe(
      'http://localhost:3031/v1/cron/tick',
    );
    expect(resolveApiPath('http://localhost:3031/v1/', '/v1/jobs/push-to-drain')).toBe(
      'http://localhost:3031/v1/jobs/push-to-drain',
    );
    expect(resolveApiPath('http://localhost:3031', '/v1/cron/tick')).toBe(
      'http://localhost:3031/v1/cron/tick',
    );
  });
});

describe('buildSecretUrlConfigStatus', () => {
  it('reports unconfigured when no row exists', () => {
    const status = buildSecretUrlConfigStatus(null, 'http://default/v1/cron/tick', 'app-secret');
    expect(status).toEqual({
      configured: false,
      url: null,
      defaultUrl: 'http://default/v1/cron/tick',
      hasSecret: false,
      secretLength: 0,
      appConfigSecretLength: 'app-secret'.length,
      secretMatchesAppConfig: false,
    });
  });

  it('reports configured and matching when the stored secret equals app-config', () => {
    const status = buildSecretUrlConfigStatus(
      { url: 'http://stored/v1/cron/tick', secret: 'app-secret' },
      'http://default/v1/cron/tick',
      'app-secret',
    );
    expect(status.configured).toBe(true);
    expect(status.url).toBe('http://stored/v1/cron/tick');
    expect(status.secretMatchesAppConfig).toBe(true);
  });

  it('reports configured but not matching when the stored secret drifted from app-config', () => {
    const status = buildSecretUrlConfigStatus(
      { url: 'http://stored/v1/cron/tick', secret: 'stale-secret' },
      'http://default/v1/cron/tick',
      'app-secret',
    );
    expect(status.configured).toBe(true);
    expect(status.secretMatchesAppConfig).toBe(false);
  });

  it('treats an empty stored secret as not configured even with a url set', () => {
    const status = buildSecretUrlConfigStatus(
      { url: 'http://stored/v1/cron/tick', secret: '' },
      'http://default/v1/cron/tick',
      'app-secret',
    );
    expect(status.configured).toBe(false);
    expect(status.hasSecret).toBe(false);
  });
});
