import { getCheckServiceRunServiceData } from '@curvenote/scms-core';
import type { CheckServiceRunRow } from './db.server';
import { isCheckServiceRunSupersededByRetry } from './db.server';

export type WorkVersionForCheckRunSummary = {
  id: string;
  date_created: string;
};

/** A check service run paired with the version context needed for display. */
export type ServiceRunEntry = {
  run: CheckServiceRunRow;
  workVersionId: string;
  /** Version number by date_created order (v1 = oldest). */
  versionNumber: number;
  /** ISO date for the work version (used for tooltip on the version tag). */
  versionDateCreated: string;
};

export type CheckRunSummaryByKind = {
  latestRunByServiceKind: Record<string, ServiceRunEntry>;
  previousRunsByServiceKind: Record<string, ServiceRunEntry[]>;
};

export function getCheckRunSummaryByKind(
  nonDraftVersions: WorkVersionForCheckRunSummary[],
  runsByVersionId: Record<string, CheckServiceRunRow[]>,
): CheckRunSummaryByKind {
  // Version numbering: v1 = oldest (by date_created).
  // Callers pass versions newest-first, so the highest number is first.
  const versionNumberByWorkVersionId: Record<string, number> = {};
  nonDraftVersions.forEach((version, index) => {
    versionNumberByWorkVersionId[version.id] = nonDraftVersions.length - index;
  });

  // For each version, keep only that version's latest run per kind, then sort
  // each kind by run date so the newest run across all versions is first.
  const entriesByKind: Record<string, ServiceRunEntry[]> = {};
  for (const version of nonDraftVersions) {
    const runs = runsByVersionId[version.id] ?? [];
    const seenKind = new Set<string>();
    for (const run of runs) {
      if (isCheckServiceRunSupersededByRetry(run)) continue;
      if (seenKind.has(run.kind)) continue;
      seenKind.add(run.kind);
      const list = entriesByKind[run.kind] ?? [];
      list.push({
        run,
        workVersionId: version.id,
        versionNumber: versionNumberByWorkVersionId[version.id] ?? 0,
        versionDateCreated: version.date_created,
      });
      entriesByKind[run.kind] = list;
    }
  }

  for (const kind of Object.keys(entriesByKind)) {
    entriesByKind[kind].sort((a, b) =>
      a.run.date_created > b.run.date_created
        ? -1
        : a.run.date_created < b.run.date_created
          ? 1
          : 0,
    );
  }

  const latestRunByServiceKind: Record<string, ServiceRunEntry> = {};
  const previousRunsByServiceKind: Record<string, ServiceRunEntry[]> = {};
  for (const [kind, list] of Object.entries(entriesByKind)) {
    const [head, ...rest] = list;
    if (head) {
      latestRunByServiceKind[kind] = head;
    }
    previousRunsByServiceKind[kind] = rest;
  }

  return { latestRunByServiceKind, previousRunsByServiceKind };
}

/**
 * For work-list summaries, pick the newest run per check kind that passes the visibility
 * predicate (e.g. latest non-error run when error runs are hidden from the listing).
 */
export function selectWorkListVisibleRunsByServiceKind(
  summary: CheckRunSummaryByKind,
  isVisible: (kind: string, metadata: unknown) => boolean,
): Record<string, ServiceRunEntry> {
  const visibleRuns: Record<string, ServiceRunEntry> = {};

  for (const [kind, latest] of Object.entries(summary.latestRunByServiceKind)) {
    const candidates = [latest, ...(summary.previousRunsByServiceKind[kind] ?? [])];
    const match = candidates.find((entry) =>
      isVisible(kind, getCheckServiceRunServiceData(entry.run)),
    );
    if (match) {
      visibleRuns[kind] = match;
    }
  }

  return visibleRuns;
}
