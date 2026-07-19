import { describe, expect, it } from 'vitest';
import { assertValidDrainUrl } from '../../src/backend/jobs/enqueue/jobQueueAdmin.server.js';

const api = {
  url: 'http://localhost:3031/v1',
  tasksCallbackUrl: 'http://host.docker.internal:3031/v1',
};

describe('assertValidDrainUrl', () => {
  it('accepts the drain path on an allowed host', () => {
    expect(assertValidDrainUrl('http://localhost:3031/v1/jobs/push-to-drain', api)).toBe(
      'http://localhost:3031/v1/jobs/push-to-drain',
    );
    expect(
      assertValidDrainUrl('http://host.docker.internal:3031/v1/jobs/push-to-drain', api),
    ).toBe('http://host.docker.internal:3031/v1/jobs/push-to-drain');
  });

  it('accepts trailing slash on the drain path', () => {
    expect(assertValidDrainUrl('http://localhost:3031/v1/jobs/push-to-drain/', api)).toBe(
      'http://localhost:3031/v1/jobs/push-to-drain/',
    );
  });

  it('rejects external hosts', () => {
    expect(() =>
      assertValidDrainUrl('https://evil.example/v1/jobs/push-to-drain', api),
    ).toThrow(/host must match app-config API host/);
  });

  it('rejects wrong path on an allowed host', () => {
    expect(() => assertValidDrainUrl('http://localhost:3031/v1/other', api)).toThrow(
      /path must be/,
    );
  });

  it('rejects non-http schemes', () => {
    expect(() =>
      assertValidDrainUrl('ftp://localhost:3031/v1/jobs/push-to-drain', api),
    ).toThrow(/http or https/);
  });

  it('rejects malformed URLs', () => {
    expect(() => assertValidDrainUrl('not-a-url', api)).toThrow(/must be a valid absolute URL/);
  });
});
