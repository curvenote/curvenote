/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { KnownJobTypes } from '@curvenote/scms-core';

const mockGetUserById = vi.fn();
const mockAssertSitePublishingScopesForUser = vi.fn();

vi.mock('../../src/backend/context.server.js', () => ({
  getUserById: (...args: unknown[]) => mockGetUserById(...args),
}));

vi.mock('../../src/backend/jobs/handlers/utils.server.js', () => ({
  assertSitePublishingScopesForUser: (...args: unknown[]) =>
    mockAssertSitePublishingScopesForUser(...args),
}));

const { validateEnqueuePublishingScopes } = await import(
  '../../src/backend/jobs/enqueue/validateEnqueuePublishingScopes.server.js'
);

describe('validateEnqueuePublishingScopes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserById.mockResolvedValue({ id: 'user-1' });
    mockAssertSitePublishingScopesForUser.mockResolvedValue(undefined);
  });

  test('allows non-publishing parent job types with no dependents', async () => {
    await validateEnqueuePublishingScopes({
      job_id: 'job-1',
      job_type: KnownJobTypes.CHECK,
      payload: {},
      invoked_by_id: 'user-1',
    });

    expect(mockAssertSitePublishingScopesForUser).not.toHaveBeenCalled();
  });

  test('checks scope for a PUBLISH parent job', async () => {
    await validateEnqueuePublishingScopes({
      job_id: 'job-1',
      job_type: KnownJobTypes.PUBLISH,
      payload: { submission_version_id: 'sv-1' },
      invoked_by_id: 'user-1',
    });

    expect(mockAssertSitePublishingScopesForUser).toHaveBeenCalledWith({ id: 'user-1' }, 'sv-1');
  });

  test('checks scope for a PUBLISH dependent even when the parent is a CHECK job', async () => {
    await validateEnqueuePublishingScopes({
      job_id: 'job-1',
      job_type: KnownJobTypes.CHECK,
      payload: {},
      invoked_by_id: 'user-1',
      dependents: [
        {
          job_id: 'dep-1',
          job_type: KnownJobTypes.PUBLISH,
          payload: { submission_version_id: 'sv-victim' },
          trigger_on: 'success',
        },
      ],
    });

    expect(mockAssertSitePublishingScopesForUser).toHaveBeenCalledWith(
      { id: 'user-1' },
      'sv-victim',
    );
  });

  test('rejects a PUBLISH dependent missing submission_version_id in its own payload', async () => {
    let caught: unknown;
    try {
      await validateEnqueuePublishingScopes({
        job_id: 'job-1',
        job_type: KnownJobTypes.CHECK,
        payload: { submission_version_id: 'sv-parent' },
        invoked_by_id: 'user-1',
        dependents: [
          {
            job_id: 'dep-1',
            job_type: KnownJobTypes.UNPUBLISH,
            payload: {},
            trigger_on: 'success',
          },
        ],
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Response);
    const body = await (caught as Response).json();
    expect(body.message).toMatch(/submission_version_id/);
    expect(mockAssertSitePublishingScopesForUser).not.toHaveBeenCalled();
  });

  test('does not check scope for non-publishing dependents', async () => {
    await validateEnqueuePublishingScopes({
      job_id: 'job-1',
      job_type: KnownJobTypes.CHECK,
      payload: {},
      invoked_by_id: 'user-1',
      dependents: [
        { job_id: 'dep-1', job_type: KnownJobTypes.CHECK, payload: {}, trigger_on: 'success' },
      ],
    });

    expect(mockAssertSitePublishingScopesForUser).not.toHaveBeenCalled();
  });

  test('propagates the scope failure from a rejected dependent', async () => {
    mockAssertSitePublishingScopesForUser.mockRejectedValueOnce(new Error('forbidden'));

    await expect(
      validateEnqueuePublishingScopes({
        job_id: 'job-1',
        job_type: KnownJobTypes.CHECK,
        payload: {},
        invoked_by_id: 'user-1',
        dependents: [
          {
            job_id: 'dep-1',
            job_type: KnownJobTypes.PUBLISH,
            payload: { submission_version_id: 'sv-victim' },
            trigger_on: 'success',
          },
        ],
      }),
    ).rejects.toThrow('forbidden');
  });
});
