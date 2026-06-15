import type {
  VersionTimelineDisplayItem,
  VersionTimelineEntry,
  TrimmedVersionTimeline,
  WorkVersionTimelineEntry,
} from '../types/versionTimeline.js';

export type {
  VersionTimelineDisplayItem,
  TrimmedVersionTimeline,
} from '../types/versionTimeline.js';

export const VERSION_TIMELINE_MAX_VISIBLE = 8;

function selectIndices(
  count: number,
  maxVisible: number,
  required: number[],
  score: (index: number) => number,
): number[] {
  if (count <= maxVisible) {
    return Array.from({ length: count }, (_, index) => index);
  }

  const selected = new Set<number>();
  for (const index of required) {
    if (index >= 0 && index < count) {
      selected.add(index);
    }
  }

  const candidates = Array.from({ length: count }, (_, index) => index)
    .filter((index) => !selected.has(index))
    .sort((a, b) => {
      const scoreDiff = score(b) - score(a);
      if (scoreDiff !== 0) return scoreDiff;
      return a - b;
    });

  for (const index of candidates) {
    if (selected.size >= maxVisible) break;
    selected.add(index);
  }

  return [...selected].sort((a, b) => a - b);
}

export function buildDisplayItems<T>(
  versions: T[],
  selectedIndices: number[],
): VersionTimelineDisplayItem<T>[] {
  if (selectedIndices.length === 0) {
    return [];
  }

  const items: VersionTimelineDisplayItem<T>[] = [];
  let previousIndex = -1;

  for (const index of selectedIndices) {
    const gap = index - previousIndex - 1;
    if (gap > 0) {
      items.push({ type: 'gap', hiddenCount: gap });
    }
    items.push({ type: 'version', version: versions[index] });
    previousIndex = index;
  }

  return items;
}

export function trimVersionTimeline<T>(
  versions: T[],
  options: {
    seeAllHref: string;
    maxVisible?: number;
    requiredIndices: number[];
    score: (index: number, version: T) => number;
  },
): TrimmedVersionTimeline<T> {
  const maxVisible = options.maxVisible ?? VERSION_TIMELINE_MAX_VISIBLE;
  const selectedIndices = selectIndices(
    versions.length,
    maxVisible,
    options.requiredIndices,
    (index) => options.score(index, versions[index]),
  );

  return {
    total: versions.length,
    hidden: versions.length - selectedIndices.length,
    seeAllHref: options.seeAllHref,
    items: buildDisplayItems(versions, selectedIndices),
  };
}

/** Oldest published version, otherwise the inaugural (oldest) version. */
export function firstSignificantSubmissionVersionIndex(versions: VersionTimelineEntry[]): number {
  if (versions.length === 0) return 0;

  for (let index = versions.length - 1; index >= 0; index -= 1) {
    if (versions[index].date_published) {
      return index;
    }
  }

  return versions.length - 1;
}

export function submissionVersionTimelineScore(
  index: number,
  version: VersionTimelineEntry,
  count: number,
): number {
  let score = count - index;
  if (version.date_published) {
    score += 1_000;
  }
  return score;
}

export function trimSubmissionVersionTimeline(
  versions: VersionTimelineEntry[],
  seeAllHref: string,
): TrimmedVersionTimeline<VersionTimelineEntry> {
  const required = [firstSignificantSubmissionVersionIndex(versions)];

  return trimVersionTimeline(versions, {
    seeAllHref,
    requiredIndices: required,
    score: (index, version) => submissionVersionTimelineScore(index, version, versions.length),
  });
}

function workVersionHasSubmissionVersions(version: WorkVersionTimelineEntry): boolean {
  return (version.submissionVersions?.length ?? 0) > 0;
}

function workVersionHasPublishedSubmission(version: WorkVersionTimelineEntry): boolean {
  return (version.submissionVersions ?? []).some((sv) => Boolean(sv.date_published));
}

export function workVersionTimelineScore(
  index: number,
  version: WorkVersionTimelineEntry,
  count: number,
): number {
  let score = count - index;
  if (workVersionHasSubmissionVersions(version)) {
    score += 500;
  }
  if (workVersionHasPublishedSubmission(version)) {
    score += 1_000;
  }
  return score;
}

export function trimWorkVersionTimeline(
  versions: WorkVersionTimelineEntry[],
  seeAllHref: string,
): TrimmedVersionTimeline<WorkVersionTimelineEntry> {
  const required = versions.length > 0 ? [versions.length - 1] : [];

  return trimVersionTimeline(versions, {
    seeAllHref,
    requiredIndices: required,
    score: (index, version) => workVersionTimelineScore(index, version, versions.length),
  });
}
