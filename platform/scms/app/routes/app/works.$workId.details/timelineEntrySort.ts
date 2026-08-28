/**
 * Minimal shape needed for within-section timeline ordering.
 * Full {@link TimelineEntry} values satisfy this.
 */
export type TimelineEntrySortable = {
  kind: string;
  date: string;
  sortRank?: number;
};

/** Truncate to minute resolution for sort comparison (items in same minute are tied). */
export function toMinuteKey(dateStr: string): number {
  const d = new Date(dateStr);
  d.setSeconds(0, 0);
  return d.getTime();
}

/**
 * Sort comparator for timeline section entries (most recent first).
 *
 * Within the same minute: check-service-run first; then extension items
 * (ascending sortRank among themselves); then other kinds by timestamp.
 * Equal sortRank among extension items falls through to date.
 */
export function compareTimelineEntries(a: TimelineEntrySortable, b: TimelineEntrySortable): number {
  const minA = toMinuteKey(a.date);
  const minB = toMinuteKey(b.date);
  if (minA > minB) return -1;
  if (minA < minB) return 1;
  // Tie (same minute): check-service-run first; then all extension items (ordered by
  // sortRank among themselves only); then other kinds by timestamp.
  if (a.kind === 'check-service-run' && b.kind !== 'check-service-run') return -1;
  if (a.kind !== 'check-service-run' && b.kind === 'check-service-run') return 1;
  if (a.kind === 'extension-timeline-item' && b.kind === 'extension-timeline-item') {
    const rankA = a.sortRank ?? 0;
    const rankB = b.sortRank ?? 0;
    if (rankA !== rankB) return rankA - rankB;
  } else if (a.kind === 'extension-timeline-item' && b.kind !== 'extension-timeline-item') {
    return -1;
  } else if (a.kind !== 'extension-timeline-item' && b.kind === 'extension-timeline-item') {
    return 1;
  }
  return a.date > b.date ? -1 : a.date < b.date ? 1 : 0;
}
