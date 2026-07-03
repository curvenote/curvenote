import { describe, expect, it } from 'vitest';
import { assertAllowedCronTargetUrl } from '../../src/backend/cron/assertAllowedCronTargetUrl.server.js';

const api = {
  url: 'http://localhost:3031/v1',
  tasksCallbackUrl: 'http://host.docker.internal:3031/v1',
};

describe('assertAllowedCronTargetUrl', () => {
  it('accepts a target_url on an allowed host, any path', () => {
    expect(
      assertAllowedCronTargetUrl('http://localhost:3031/v1/hooks/text-integrity/retry-sweep', api),
    ).toBe('http://localhost:3031/v1/hooks/text-integrity/retry-sweep');
    expect(
      assertAllowedCronTargetUrl('http://host.docker.internal:3031/v1/jobs/push-to-drain', api),
    ).toBe('http://host.docker.internal:3031/v1/jobs/push-to-drain');
  });

  it('rejects external hosts', () => {
    expect(() =>
      assertAllowedCronTargetUrl('https://evil.example/v1/hooks/text-integrity/retry-sweep', api),
    ).toThrow(/host must match our own API host/);
  });

  it('rejects non-http schemes', () => {
    expect(() => assertAllowedCronTargetUrl('ftp://localhost:3031/v1/anything', api)).toThrow(
      /http or https/,
    );
  });

  it('rejects malformed URLs', () => {
    expect(() => assertAllowedCronTargetUrl('not-a-url', api)).toThrow(
      /must be a valid absolute URL/,
    );
  });
});
