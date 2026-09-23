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
    const row = createRow([
      createActivity({
        activity_type: 'DOI_REGISTRATION_STARTED',
        data: { doi: '10.1/x', depositId: 'd' },
      }),
    ]);

    const { submission } = formatSubmissionDetailSubmission(createContext(), row);

    expect(submission.activity[0].doi_registration).toEqual({ doi: '10.1/x' });
  });

  test('a failed registration shows the readable reason, and Crossref message as detail', () => {
    const row = createRow([
      createActivity({
        activity_type: 'DOI_REGISTRATION_FAILED',
        data: { doi: '10.62329/abc', depositId: 'dep-1', error: 'cvc-complex-type.2.4.a' },
      }),
    ]);
    const { submission } = formatSubmissionDetailSubmission(createContext(), row);
    expect(submission.activity[0].doi_registration).toEqual({
      doi: '10.62329/abc',
      reason: 'Crossref rejected the metadata. Fix the submission and retry.',
      detail: 'cvc-complex-type.2.4.a',
    });
  });

  test('a failed registration never shows an internal code', () => {
    const row = createRow([
      createActivity({
        activity_type: 'DOI_REGISTRATION_FAILED',
        data: { doi: '10.62329/abc', depositId: 'dep-1', error: 'internal_error' },
      }),
    ]);
    const { submission } = formatSubmissionDetailSubmission(createContext(), row);
    expect(submission.activity[0].doi_registration).toEqual({
      doi: '10.62329/abc',
      reason: "We couldn't submit the registration to Crossref. No DOI was registered.",
    });
  });

  test('a registration with a warning shows it as a warning', () => {
    const row = createRow([
      createActivity({
        activity_type: 'DOI_REGISTRATION_COMPLETED',
        data: { doi: '10.62329/abc', depositId: 'dep-1', warning: 'Added with conflict' },
      }),
    ]);
    const { submission } = formatSubmissionDetailSubmission(createContext(), row);
    expect(submission.activity[0].doi_registration).toEqual({
      doi: '10.62329/abc',
      warning: 'Added with conflict',
    });
  });

  test('a registration completed without a warning shows just the doi', () => {
    const row = createRow([
      createActivity({
        activity_type: 'DOI_REGISTRATION_COMPLETED',
        data: { doi: '10.3/z', depositId: 'd' },
      }),
    ]);

    const { submission } = formatSubmissionDetailSubmission(createContext(), row);

    expect(submission.activity[0].doi_registration).toEqual({ doi: '10.3/z' });
  });

  test('SUBMISSION_KIND_CHANGE activity does not have doi_registration', () => {
    const row = createRow([
      createActivity({
        activity_type: 'SUBMISSION_KIND_CHANGE',
        kind: { name: 'article' },
        data: {},
      }),
    ]);

    const { submission } = formatSubmissionDetailSubmission(createContext(), row);

    expect(submission.activity[0].doi_registration).toBeUndefined();
  });
});
