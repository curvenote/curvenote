// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import type { VersionTimelineEntry, WorkVersionTimelineEntry } from '../types/versionTimeline.js';
import {
  VERSION_TIMELINE_MAX_VISIBLE,
  buildDisplayItems,
  firstSignificantSubmissionVersionIndex,
  trimSubmissionVersionTimeline,
  trimWorkVersionTimeline,
} from './versionTimelineTrim.js';

function submissionVersion(id: string, published?: string): VersionTimelineEntry {
  return {
    id,
    date_created: id,
    date_modified: id,
    date_published: published,
    status: published ? 'PUBLISHED' : 'DRAFT',
    statusLabel: published ? 'Published' : 'Draft',
  };
}

function workVersion(
  id: string,
  options: {
    submissionVersions?: WorkVersionTimelineEntry['submissionVersions'];
    versionNumber?: number;
  } = {},
): WorkVersionTimelineEntry {
  return {
    id,
    date_created: id,
    date_modified: id,
    draft: false,
    versionNumber: options.versionNumber ?? 1,
    submissionVersions: options.submissionVersions,
  };
}

describe('buildDisplayItems', () => {
  it('inserts gap items between non-adjacent indices', () => {
    const versions = ['a', 'b', 'c', 'd', 'e'];
    const items = buildDisplayItems(versions, [0, 2, 4]);

    expect(items).toEqual([
      { type: 'version', version: 'a' },
      { type: 'gap', hiddenCount: 1 },
      { type: 'version', version: 'c' },
      { type: 'gap', hiddenCount: 1 },
      { type: 'version', version: 'e' },
    ]);
  });
});

describe('firstSignificantSubmissionVersionIndex', () => {
  it('returns oldest published version when any exist', () => {
    const versions = [
      submissionVersion('new', '2026-02-01'),
      submissionVersion('mid'),
      submissionVersion('old', '2026-01-01'),
    ];

    expect(firstSignificantSubmissionVersionIndex(versions)).toBe(2);
  });

  it('returns oldest version when none are published', () => {
    const versions = [submissionVersion('new'), submissionVersion('old')];

    expect(firstSignificantSubmissionVersionIndex(versions)).toBe(1);
  });
});

describe('trimSubmissionVersionTimeline', () => {
  it('returns all versions when at or below the cap', () => {
    const versions = Array.from({ length: VERSION_TIMELINE_MAX_VISIBLE }, (_, index) =>
      submissionVersion(`v-${index}`),
    );

    const result = trimSubmissionVersionTimeline(versions, '/see-all');

    expect(result.total).toBe(VERSION_TIMELINE_MAX_VISIBLE);
    expect(result.hidden).toBe(0);
    expect(result.items.every((item) => item.type === 'version')).toBe(true);
  });

  it('keeps first significant and published versions when trimming', () => {
    const versions = Array.from({ length: 12 }, (_, index) =>
      submissionVersion(`v-${index}`, index === 11 || index === 0 ? '2026-01-01' : undefined),
    );

    const result = trimSubmissionVersionTimeline(versions, '/see-all');

    expect(result.total).toBe(12);
    expect(result.hidden).toBe(4);
    expect(result.seeAllHref).toBe('/see-all');

    const visibleIds = result.items
      .filter((item) => item.type === 'version')
      .map((item) => (item.type === 'version' ? item.version.id : ''));

    expect(visibleIds).toContain('v-11');
    expect(visibleIds).toContain('v-0');
    expect(visibleIds.length).toBe(VERSION_TIMELINE_MAX_VISIBLE);
    expect(result.items.some((item) => item.type === 'gap')).toBe(true);
  });
});

describe('trimWorkVersionTimeline', () => {
  it('always includes the first work version', () => {
    const versions = Array.from({ length: 12 }, (_, index) =>
      workVersion(`wv-${index}`, {
        submissionVersions:
          index % 3 === 0
            ? [
                {
                  id: `sv-${index}`,
                  submissionId: 'sub-1',
                  status: index === 9 ? 'PUBLISHED' : 'DRAFT',
                  statusLabel: 'Draft',
                  date_published: index === 9 ? '2026-01-01' : undefined,
                  site: { name: 'demo' },
                },
              ]
            : [],
      }),
    );

    const result = trimWorkVersionTimeline(versions, '/works/1/details');

    const visibleIds = result.items
      .filter((item) => item.type === 'version')
      .map((item) => (item.type === 'version' ? item.version.id : ''));

    expect(visibleIds).toContain('wv-11');
    expect(visibleIds.length).toBe(VERSION_TIMELINE_MAX_VISIBLE);
    expect(result.hidden).toBe(4);
  });
});
