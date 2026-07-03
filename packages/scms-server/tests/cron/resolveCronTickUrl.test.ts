import { describe, expect, it } from 'vitest';
import {
  assertAllowedCronTickUrl,
  collectAllowedCronTickHosts,
  resolveCronTickUrl,
  resolveStoredCronTickUrl,
} from '../../src/backend/cron/resolveCronTickUrl.server.js';

const api = {
  url: 'http://localhost:3031/v1',
  tasksCallbackUrl: 'http://host.docker.internal:3031/v1',
};

describe('resolveCronTickUrl', () => {
  it('appends /v1/cron/tick to API base', () => {
    expect(resolveCronTickUrl('http://localhost:3031/v1')).toBe(
      'http://localhost:3031/v1/cron/tick',
    );
  });
});

describe('collectAllowedCronTickHosts', () => {
  it('includes hosts from api.url, tasksCallbackUrl, and resolved tick URL', () => {
    const hosts = collectAllowedCronTickHosts(api);
    expect(hosts.has('localhost:3031')).toBe(true);
    expect(hosts.has('host.docker.internal:3031')).toBe(true);
  });
});

describe('assertAllowedCronTickUrl', () => {
  it('accepts tick URL on an allowed host with correct path', () => {
    expect(assertAllowedCronTickUrl('http://localhost:3031/v1/cron/tick', api)).toBe(
      'http://localhost:3031/v1/cron/tick',
    );
    expect(
      assertAllowedCronTickUrl('http://host.docker.internal:3031/v1/cron/tick', api),
    ).toBe('http://host.docker.internal:3031/v1/cron/tick');
  });

  it('accepts trailing slash on tick path', () => {
    expect(assertAllowedCronTickUrl('http://localhost:3031/v1/cron/tick/', api)).toBe(
      'http://localhost:3031/v1/cron/tick/',
    );
  });

  it('rejects external hosts', () => {
    expect(() =>
      assertAllowedCronTickUrl('https://evil.example/v1/cron/tick', api),
    ).toThrow(/host must match app-config API host/);
  });

  it('rejects wrong path on allowed host', () => {
    expect(() =>
      assertAllowedCronTickUrl('http://localhost:3031/v1/other', api),
    ).toThrow(/path must be/);
  });

  it('rejects non-http schemes', () => {
    expect(() =>
      assertAllowedCronTickUrl('ftp://localhost:3031/v1/cron/tick', api),
    ).toThrow(/http or https/);
  });

  it('respects api.cron.tickUrl host override', () => {
    const withOverride = {
      url: 'https://scms.example.com/v1',
      cron: { tickUrl: 'https://scms.example.com/v1/cron/tick' },
    };
    expect(
      assertAllowedCronTickUrl('https://scms.example.com/v1/cron/tick', withOverride),
    ).toBe('https://scms.example.com/v1/cron/tick');
    expect(() =>
      assertAllowedCronTickUrl('http://localhost:3031/v1/cron/tick', withOverride),
    ).toThrow(/host must match/);
  });
});

describe('resolveStoredCronTickUrl', () => {
  it('prefers cron.tickUrl when set', () => {
    expect(
      resolveStoredCronTickUrl({
        url: 'http://localhost:3031/v1',
        cron: { tickUrl: 'https://scms.example.com/v1/cron/tick' },
      }),
    ).toBe('https://scms.example.com/v1/cron/tick');
  });
});
