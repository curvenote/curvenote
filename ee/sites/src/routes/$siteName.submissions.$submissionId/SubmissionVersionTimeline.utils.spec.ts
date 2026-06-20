// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import * as timelineUtils from './SubmissionVersionTimeline.utils.js';
import { sortEntriesNewestFirst, type TimelineEntry } from './SubmissionVersionTimeline.js';
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
    const result = timelineUtils.groupSubmissionActivitiesByVersion(
      [activity('activity-1', { submission_version: { id: 'version-a', date_created: '' } })],
      [version('version-a', 'work-version-a')],
    );

    expect(result.grouped.get('version-a')?.map((item) => item.id)).toEqual(['activity-1']);
    expect(result.submissionLevel).toEqual([]);
  });

  it('falls back to work version id when direct submission version id is unknown', () => {
    const result = timelineUtils.groupSubmissionActivitiesByVersion(
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
    const result = timelineUtils.groupSubmissionActivitiesByVersion(
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

describe('getSubmissionTimelineSections', () => {
  it('interleaves submission-level activity sections with version sections by date', () => {
    const olderSubmissionActivity = {
      ...activity('activity-1'),
      date_created: '2026-06-20T00:00:01.000Z',
    };
    const newerVersion = {
      ...version('version-a', 'work-version-a'),
      date_created: '2026-06-20T00:00:03.000Z',
    };

    expect(
      timelineUtils
        .getSubmissionTimelineSections([newerVersion], [olderSubmissionActivity])
        .map((section) => section.key),
    ).toEqual(['version-version-a', 'submission-activity-activity-1']);
  });
});

describe('sortEntriesNewestFirst', () => {
  function entry(kind: TimelineEntry['kind'], key: string, date: string): TimelineEntry {
    return { kind, key, date } as TimelineEntry;
  }

  it('uses a symmetric kind tie-break for entries with identical timestamps', () => {
    const date = '2026-06-20T00:00:00.000Z';

    expect(
      sortEntriesNewestFirst([
        entry('activity', 'activity-1', date),
        entry('activity', 'activity-2', date),
      ]).map((item) => item.key),
    ).toEqual(['activity-1', 'activity-2']);

    expect(
      sortEntriesNewestFirst([
        entry('activity', 'activity-1', date),
        entry('check-service-run', 'check-run-1', date),
        entry('version', 'version-1', date),
      ]).map((item) => item.kind),
    ).toEqual(['version', 'check-service-run', 'activity']);
  });
});
