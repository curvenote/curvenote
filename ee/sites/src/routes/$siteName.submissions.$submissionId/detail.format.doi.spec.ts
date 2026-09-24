/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect } from 'vitest';
import { formatSubmissionDetailSubmission } from './detail.format.server.js';
import type { SubmissionDetailRow } from './db.server.js';
import type { SiteContext } from '@curvenote/scms-server';

// Minimal builders for test data
function createActivity(overrides: Partial<SubmissionDetailRow['activity'][number]> = {}) {
  return {
    id: 'activity-1',
    date_created: new Date('2026-01-01'),
    activity_by: { display_name: 'Test User' },
    activity_type: 'DOI_REGISTRATION_STARTED',
    status: undefined,
    kind: undefined,
    submission_version: undefined,
    work_version: undefined,
    date_published: undefined,
    data: {},
    ...overrides,
  };
}

function createRow(activities: SubmissionDetailRow['activity']): SubmissionDetailRow {
  return {
    id: 'submission-1',
    date_created: new Date('2026-01-01'),
    date_published: undefined,
    kind: { id: 'kind-1', name: 'article', content: null },
    collection: { id: 'coll-1', name: 'collection', workflow: 'default', content: null },
    submitted_by: { id: 'user-1', display_name: 'Submitter' },
    slugs: [{ primary: true, slug: 'test-slug' }],
    tags: [],
    versions: [
      {
        id: 'version-1',
        date_created: new Date('2026-01-01'),
        date_published: undefined,
        status: 'DRAFT',
        tags: [],
        submitted_by: { id: 'user-1', display_name: 'Submitter' },
        job_id: undefined,
        work_version: {
          id: 'wv-1',
          work_id: 'work-1',
          title: 'Test',
          description: undefined,
          authors: [],
          doi: undefined,
          cdn: undefined,
          cdn_key: undefined,
        },
        transition: undefined,
      },
    ],
    activity: activities,
    work: undefined,
  };
}

function createContext(): SiteContext {
  return {
    site: { id: 'site-1', name: 'test-site' } as any,
    asBaseUrl: (path) => `https://example.com${path}`,
    asApiUrl: (path) => `https://api.example.com${path}`,
  } as any;
}

describe('formatDetailActivity - DOI Registration', () => {
  test('DOI_REGISTRATION_STARTED activity formats to doi_registration with just the doi', () => {
    const ctx = createContext();
    const row = createRow([
      createActivity({
        activity_type: 'DOI_REGISTRATION_STARTED',
        data: { doi: '10.1/x', depositId: 'd' },
      }),
    ]);

    const { submission } = formatSubmissionDetailSubmission(ctx, row);
    const activity = submission.activity[0];

    expect(activity.doi_registration).toEqual({ doi: '10.1/x' });
  });

  test('DOI_REGISTRATION_FAILED activity carries the stored error', () => {
    const ctx = createContext();
    const row = createRow([
      createActivity({
        activity_type: 'DOI_REGISTRATION_FAILED',
        data: { doi: '10.2/y', depositId: 'd', error: 'site_credentials_rejected' },
      }),
    ]);

    const { submission } = formatSubmissionDetailSubmission(ctx, row);
    const activity = submission.activity[0];

    expect(activity.doi_registration).toEqual({
      doi: '10.2/y',
      error: 'site_credentials_rejected',
    });
  });

  test('DOI_REGISTRATION_COMPLETED activity without a warning', () => {
    const ctx = createContext();
    const row = createRow([
      createActivity({
        activity_type: 'DOI_REGISTRATION_COMPLETED',
        data: { doi: '10.3/z', depositId: 'd' },
      }),
    ]);

    const { submission } = formatSubmissionDetailSubmission(ctx, row);
    const activity = submission.activity[0];

    expect(activity.doi_registration).toEqual({ doi: '10.3/z' });
  });

  test('DOI_REGISTRATION_COMPLETED activity carries the warning', () => {
    const ctx = createContext();
    const row = createRow([
      createActivity({
        activity_type: 'DOI_REGISTRATION_COMPLETED',
        data: { doi: '10.3/z', depositId: 'd', warning: 'Added with conflict' },
      }),
    ]);

    const { submission } = formatSubmissionDetailSubmission(ctx, row);
    const activity = submission.activity[0];

    expect(activity.doi_registration).toEqual({ doi: '10.3/z', warning: 'Added with conflict' });
  });

  test('SUBMISSION_KIND_CHANGE activity does not have doi_registration', () => {
    const ctx = createContext();
    const row = createRow([
      createActivity({
        activity_type: 'SUBMISSION_KIND_CHANGE',
        kind: { name: 'article' },
        data: {},
      }),
    ]);

    const { submission } = formatSubmissionDetailSubmission(ctx, row);
    const activity = submission.activity[0];

    expect(activity.doi_registration).toBeUndefined();
  });
});
