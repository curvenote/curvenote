// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { compareTimelineEntries, type TimelineEntrySortable } from './timelineEntrySort';

function entry(kind: string, date: string, sortRank?: number): TimelineEntrySortable {
  return sortRank === undefined ? { kind, date } : { kind, date, sortRank };
}

describe('compareTimelineEntries', () => {
  it('orders extension items ahead of activity in the same minute', () => {
    const activity = entry('activity', '2026-01-02T12:00:30.000Z');
    const extension = entry('extension-timeline-item', '2026-01-02T12:00:10.000Z', 50);

    expect([activity, extension].sort(compareTimelineEntries).map((e) => e.kind)).toEqual([
      'extension-timeline-item',
      'activity',
    ]);
    expect([extension, activity].sort(compareTimelineEntries).map((e) => e.kind)).toEqual([
      'extension-timeline-item',
      'activity',
    ]);
  });

  it('orders two extension items by ascending sortRank within the same minute', () => {
    const laterRank = entry('extension-timeline-item', '2026-01-02T12:00:40.000Z', 20);
    const earlierRank = entry('extension-timeline-item', '2026-01-02T12:00:10.000Z', 10);

    expect([laterRank, earlierRank].sort(compareTimelineEntries).map((e) => e.sortRank)).toEqual([
      10, 20,
    ]);
  });

  it('falls back to date when extension items share the same sortRank', () => {
    const older = entry('extension-timeline-item', '2026-01-02T12:00:10.000Z', 10);
    const newer = entry('extension-timeline-item', '2026-01-02T12:00:50.000Z', 10);

    expect([older, newer].sort(compareTimelineEntries).map((e) => e.date)).toEqual([
      '2026-01-02T12:00:50.000Z',
      '2026-01-02T12:00:10.000Z',
    ]);
  });
});
