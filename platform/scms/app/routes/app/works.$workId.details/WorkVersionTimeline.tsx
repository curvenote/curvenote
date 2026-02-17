import { useSearchParams } from 'react-router';
import { formatDate, scopes } from '@curvenote/scms-core';
import type { WorkVersionWithSubmissionVersions } from '../works.$workId/types';
import type { WorkActivityRow } from '../works.$workId/db.server';
import type { Workflow } from '@curvenote/scms-core';
import type { LinkedJobsByWorkVersionId } from './types';
import { Timeline } from './timeline/Timeline';
import { TimelineSection } from './timeline/TimelineSection';
import { VersionCreatedTimelineItem } from './timeline/VersionCreatedTimelineItem';
import { SubmissionTimelineItem } from './timeline/SubmissionTimelineItem';
import { ActivityTimelineItem } from './timeline/ActivityTimelineItem';

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
    };

/** Build section entries and sort by date descending (most recent first). */
function getSortedSectionEntries(
  version: WorkVersionWithSubmissionVersions,
  submissionVersionsToShow: SubmissionVersionRow[],
  activitiesForVersion: WorkActivityRow[],
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
  ];
  entries.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
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
};

/**
 * Renders a stem timeline of work versions. Within each section, items are ordered
 * chronologically (most recent first): work version, submissions, and activities
 * are merged and sorted by date. Custom icons per submission/activity state could
 * be added later (e.g. different icons for published vs submitted).
 */
export function WorkVersionTimeline({
  versions,
  workflows,
  workOwnerName,
  basePath,
  userScopes,
  linkedJobsByWorkVersionId,
  activities,
}: WorkVersionTimelineProps) {
  const [searchParams] = useSearchParams();
  const includeDrafts = searchParams.get('drafts') === 'true';
  const canExport = userScopes.includes(scopes.app.works.export);

  // Show all versions; draft versions display only their activities (and submissions), not the "Version created" row
  return (
    <Timeline title="Timeline">
      {versions.map((v) => {
        const submissionVersionsToShow = includeDrafts
          ? v.submissionVersions
          : v.submissionVersions.filter((sv) => sv.status !== 'DRAFT');
        const activitiesForVersion = activities.filter((a) => a.work_version_id === v.id);
        const label = formatDate(v.date_modified, 'MMM dd, yyyy');
        const sortedEntries = getSortedSectionEntries(
          v,
          submissionVersionsToShow,
          activitiesForVersion,
        );

        if (sortedEntries.length === 0) return null;

        return (
          <TimelineSection key={v.id} label={label}>
            {sortedEntries.map((entry) => {
              if (entry.kind === 'work-version') {
                const { version } = entry;
                return (
                  <VersionCreatedTimelineItem
                    key={entry.key}
                    dateCreated={version.date_created}
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
              return (
                <ActivityTimelineItem
                  key={entry.key}
                  activity={entry.activity}
                />
              );
            })}
          </TimelineSection>
        );
      })}
    </Timeline>
  );
}
