import { describe, expect, it } from 'vitest';
import { CronEndpointScopes } from '@curvenote/scms-core';
import { resolveScopedCronTargetUrl } from '../../src/backend/cron/resolveScopedCronTargetUrl.server.js';

const api = {
  url: 'http://localhost:3031/v1',
  tasksCallbackUrl: 'http://host.docker.internal:3031/v1',
};

describe('resolveScopedCronTargetUrl', () => {
  it('resolves built-in job-queue-drain scope from api.url when tasksCallbackUrl is unset', () => {
    expect(
      resolveScopedCronTargetUrl(
        CronEndpointScopes.JOB_QUEUE_DRAIN,
        { url: api.url },
      ),
    ).toBe('http://localhost:3031/v1/jobs/push-to-drain');
  });

  it('prefers tasksCallbackUrl for Docker dev setups', () => {
    expect(resolveScopedCronTargetUrl(CronEndpointScopes.JOB_QUEUE_DRAIN, api)).toBe(
      'http://host.docker.internal:3031/v1/jobs/push-to-drain',
    );
  });

  it('resolves promote-scheduled scope', () => {
    expect(resolveScopedCronTargetUrl(CronEndpointScopes.PROMOTE_SCHEDULED, api)).toBe(
      'http://host.docker.internal:3031/v1/jobs/promote-scheduled',
    );
  });

  it('resolves extension hook scopes from the path in target_scope', () => {
    expect(
      resolveScopedCronTargetUrl('POST:/v1/hooks/text-integrity/retry-sweep', api),
    ).toBe('http://host.docker.internal:3031/v1/hooks/text-integrity/retry-sweep');
  });

  it('throws for malformed scope strings', () => {
    expect(() => resolveScopedCronTargetUrl('not-a-scope', api)).toThrow(
      /HTTP cron missing target_url/,
    );
    expect(() => resolveScopedCronTargetUrl('POST:hooks/no-leading-slash', api)).toThrow(
      /HTTP cron missing target_url/,
    );
  });
});
