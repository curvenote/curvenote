// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { groupSubmissionActivitiesByVersion } from './SubmissionVersionTimeline.utils.js';
import type { SubmissionDetailActivity, SubmissionDetailVersion } from './types.js';

function version(id: string, workVersionId: string): SubmissionDetailVersion {
  return {
    id,
    date_created: '2026-06-20T00:00:00.000Z',
    status: 'IN_REVIEW',
    submitted_by: { id: 'user-1', name: 'Ada Lovelace' },
    site_work: {
      id: `work-${id}`,
      version_id: workVersionId,
      title: `Version ${id}`,
      authors: [],
      links: {},
    },
    links: {},
  };
}

function activity(
  id: string,
  options: Pick<SubmissionDetailActivity, 'submission_version' | 'work_version'> = {},
): SubmissionDetailActivity {
  return {
    id,
    date_created: `2026-06-20T00:00:0${id.slice(-1)}.000Z`,
    activity_by: { name: 'Grace Hopper' },
    activity_type: 'SUBMISSION_VERSION_STATUS_CHANGE',
    ...options,
  };
}

describe('groupSubmissionActivitiesByVersion', () => {
  it('groups activities by known submission version id', () => {
    const result = groupSubmissionActivitiesByVersion(
      [activity('activity-1', { submission_version: { id: 'version-a', date_created: '' } })],
      [version('version-a', 'work-version-a')],
    );

    expect(result.grouped.get('version-a')?.map((item) => item.id)).toEqual(['activity-1']);
    expect(result.submissionLevel).toEqual([]);
  });

  it('falls back to work version id when direct submission version id is unknown', () => {
    const result = groupSubmissionActivitiesByVersion(
      [
        activity('activity-2', {
          submission_version: { id: 'version-stale', date_created: '' },
          work_version: { id: 'work-version-a', date_created: '' },
        }),
      ],
      [version('version-a', 'work-version-a')],
    );

    expect(result.grouped.get('version-a')?.map((item) => item.id)).toEqual(['activity-2']);
    expect(result.submissionLevel).toEqual([]);
  });

  it('keeps orphan activities in the submission-level bucket', () => {
    const result = groupSubmissionActivitiesByVersion(
      [
        activity('activity-3', {
          submission_version: { id: 'version-stale', date_created: '' },
          work_version: { id: 'work-version-stale', date_created: '' },
        }),
      ],
      [version('version-a', 'work-version-a')],
    );

    expect(result.grouped.size).toBe(0);
    expect(result.submissionLevel.map((item) => item.id)).toEqual(['activity-3']);
  });
});
