import { useSearchParams } from 'react-router';
import { formatDate, scopes, ui } from '@curvenote/scms-core';
import type { WorkVersionWithSubmissionVersions } from '../works.$workId/types';
import type { WorkActivityRow, CheckServiceRunRow } from '../works.$workId/db.server';
import type { Workflow, ClientExtensionCheckService } from '@curvenote/scms-core';
import type { LinkedJobsByWorkVersionId } from './types';
import { Timeline } from './timeline/Timeline';
import { TimelineSection } from './timeline/TimelineSection';
import { VersionCreatedTimelineItem } from './timeline/VersionCreatedTimelineItem';
import { SubmissionTimelineItem } from './timeline/SubmissionTimelineItem';
import { ActivityTimelineItem } from './timeline/ActivityTimelineItem';
import { CheckServiceRunTimelineItem } from './timeline/CheckServiceRunTimelineItem';
import {
  TimelineActivitiesToggle,
  TimelineActivitiesVisibilityProvider,
  useTimelineActivitiesVisibility,
} from './timeline/TimelineActivitiesVisibility';

type SubmissionVersionRow = WorkVersionWithSubmissionVersions['submissionVersions'][number];

/** Unified timeline entry for chronological sorting. Date is ISO-like for sort order (newest first). */
type TimelineEntry =
  | {
      kind: 'work-version';
      date: string;
      key: string;
      version: WorkVersionWithSubmissionVersions;
    }
  | {
      kind: 'submission';
      date: string;
      key: string;
      submissionVersion: SubmissionVersionRow;
    }
  | {
      kind: 'activity';
      date: string;
      key: string;
      activity: WorkActivityRow;
    }
  | {
      kind: 'check-service-run';
      date: string;
      key: string;
      run: CheckServiceRunRow;
      version: WorkVersionWithSubmissionVersions;
    };

/** Latest run id for a given check `kind` on this work version (by `date_modified`). */
function getLatestCheckRunIdForKind(runs: CheckServiceRunRow[], kind: string): string | undefined {
  let best: CheckServiceRunRow | undefined;
  for (const r of runs) {
    if (r.kind !== kind) continue;
    if (!best || r.date_modified > best.date_modified) best = r;
  }
  return best?.id;
}

/** Truncate to minute resolution for sort comparison (items in same minute are tied). */
function toMinuteKey(dateStr: string): number {
  const d = new Date(dateStr);
  d.setSeconds(0, 0);
  return d.getTime();
}

/** Build section entries and sort by date descending (most recent first). */
function getSortedSectionEntries(
  version: WorkVersionWithSubmissionVersions,
  submissionVersionsToShow: SubmissionVersionRow[],
  activitiesForVersion: WorkActivityRow[],
  checkRunsForVersion: CheckServiceRunRow[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    // Only show the "Version created" row for finalized (non-draft) versions
    ...(version.draft
      ? []
      : [
          {
            kind: 'work-version' as const,
            date: version.date_created,
            key: `work-version-${version.id}`,
            version,
          },
        ]),
    ...submissionVersionsToShow.map((sv) => {
      const isPublished = sv.status === 'PUBLISHED';
      const date = (isPublished ? sv.date_published : null) ?? sv.date_created;
      return {
        kind: 'submission' as const,
        date,
        key: `submission-${sv.id}`,
        submissionVersion: sv,
      };
    }),
    ...activitiesForVersion.map((a) => ({
      kind: 'activity' as const,
      date: a.date_created,
      key: `activity-${a.id}`,
      activity: a,
    })),
    ...checkRunsForVersion.map((run) => ({
      kind: 'check-service-run' as const,
      date: run.date_modified,
      key: `check-run-${run.id}`,
      run,
      version,
    })),
  ];
  entries.sort((a, b) => {
    const minA = toMinuteKey(a.date);
    const minB = toMinuteKey(b.date);
    if (minA > minB) return -1;
    if (minA < minB) return 1;
    // Tie (same minute): check-service-run first; then order rest by full timestamp descending
    if (a.kind === 'check-service-run' && b.kind !== 'check-service-run') return -1;
    if (a.kind !== 'check-service-run' && b.kind === 'check-service-run') return 1;
    return a.date > b.date ? -1 : a.date < b.date ? 1 : 0;
  });
  return entries;
}

type WorkVersionTimelineProps = {
  versions: WorkVersionWithSubmissionVersions[];
  workflows: Record<string, Workflow>;
  /** Work owner display name; used for "Work version created by" */
  workOwnerName?: string | null;
  basePath: string;
  userScopes: string[];
  linkedJobsByWorkVersionId: Promise<LinkedJobsByWorkVersionId>;
  /** Activities for this work (already filtered to work). Shown per version by work_version_id. */
  activities: WorkActivityRow[];
  /** Check service runs grouped by work_version_id (for timeline check items). */
  checkServiceRunsByWorkVersionId: Record<string, CheckServiceRunRow[]>;
  /** Resolved check services from extensions (run.kind maps to service.id). */
  checkServices: ClientExtensionCheckService[];
};

/**
 * Renders a stem timeline of work versions. Within each section, items are ordered
 * chronologically (most recent first): work version, submissions, and activities
 * are merged and sorted by date. Custom icons per submission/activity state could
 * be added later (e.g. different icons for published vs submitted).
 */
export function WorkVersionTimeline(props: WorkVersionTimelineProps) {
  return (
    <TimelineActivitiesVisibilityProvider>
      <WorkVersionTimelineInner {...props} />
    </TimelineActivitiesVisibilityProvider>
  );
}

function WorkVersionTimelineInner({
  versions,
  workflows,
  workOwnerName,
  basePath,
  userScopes,
  linkedJobsByWorkVersionId,
  activities,
  checkServiceRunsByWorkVersionId,
  checkServices,
}: WorkVersionTimelineProps) {
  const { showActivities } = useTimelineActivitiesVisibility();
  const [searchParams] = useSearchParams();
  const includeDrafts = searchParams.get('drafts') === 'true';
  const canExport = userScopes.includes(scopes.app.works.export);
  const checkServiceById = Object.fromEntries(checkServices.map((s) => [s.id, s]));

  // Order sections by date_modified descending (most recently modified first)
  const versionsByModified = [...versions].sort((a, b) =>
    a.date_modified > b.date_modified ? -1 : a.date_modified < b.date_modified ? 1 : 0,
  );

  const versionsByCreatedAsc = [...versions].sort((a, b) =>
    a.date_created < b.date_created ? -1 : a.date_created > b.date_created ? 1 : 0,
  );
  const versionNumberByVersionId: Record<string, number> = {};
  versionsByCreatedAsc.forEach((ver, i) => {
    versionNumberByVersionId[ver.id] = i + 1;
  });

  // Show all versions; draft versions display only their activities (and submissions), not the "Version created" row
  return (
    <Timeline
      title="TIMELINE"
      titleClassName="text-sm font-medium uppercase tracking-wide"
      headerAction={<TimelineActivitiesToggle />}
    >
      {versionsByModified.map((v) => {
        const submissionVersionsToShow = includeDrafts
          ? v.submissionVersions
          : v.submissionVersions.filter((sv) => sv.status !== 'DRAFT');
        const activitiesForVersion = activities.filter((a) => a.work_version_id === v.id);
        const checkRunsForVersion = checkServiceRunsByWorkVersionId[v.id] ?? [];
        const versionNumber = versionNumberByVersionId[v.id] ?? 0;
        const label = (
          <span className="flex gap-2 items-center">
            <ui.TooltipProvider delayDuration={1000}>
              <ui.Tooltip delayDuration={1000}>
                <ui.TooltipTrigger asChild>
                  <span className="cursor-default">v{versionNumber}</span>
                </ui.TooltipTrigger>
                <ui.TooltipContent side="top" className="text-sm">
                  {formatDate(v.date_created, 'MMM d, yyyy h:mm:ss a')}
                </ui.TooltipContent>
              </ui.Tooltip>
            </ui.TooltipProvider>
            <span className="text-sm text-muted-foreground">
              {formatDate(v.date_created, 'MMM d, yyyy HH:mm')}
            </span>
          </span>
        );
        const sortedEntries = getSortedSectionEntries(
          v,
          submissionVersionsToShow,
          activitiesForVersion,
          checkRunsForVersion,
        );
        const visibleEntries = showActivities
          ? sortedEntries
          : sortedEntries.filter((e) => e.kind !== 'activity');

        if (visibleEntries.length === 0) return null;

        return (
          <TimelineSection key={v.id} label={label}>
            {visibleEntries.map((entry) => {
              if (entry.kind === 'work-version') {
                const { version } = entry;
                return (
                  <VersionCreatedTimelineItem
                    key={entry.key}
                    dateCreated={version.date_created}
                    dateModified={version.date_modified}
                    ownerName={workOwnerName}
                    metadata={version.metadata}
                    workVersionId={version.id}
                    basePath={basePath}
                    canExport={canExport}
                    linkedJobsByWorkVersionIdPromise={linkedJobsByWorkVersionId}
                  />
                );
              }
              if (entry.kind === 'submission') {
                return (
                  <SubmissionTimelineItem
                    key={entry.key}
                    submissionVersion={entry.submissionVersion}
                  />
                );
              }
              if (entry.kind === 'check-service-run') {
                const service = checkServiceById[entry.run.kind] ?? null;
                return (
                  <CheckServiceRunTimelineItem
                    key={entry.key}
                    run={entry.run}
                    checkService={service}
                    basePath={basePath}
                    isLatestRunForKind={
                      entry.run.id === getLatestCheckRunIdForKind(checkRunsForVersion, entry.run.kind)
                    }
                  />
                );
              }
              return <ActivityTimelineItem key={entry.key} activity={entry.activity} />;
            })}
          </TimelineSection>
        );
      })}
    </Timeline>
  );
}
