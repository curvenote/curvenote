import { useMemo, type ReactNode } from 'react';
import { useFetcher } from 'react-router';
import { Activity, ExternalLink, FileText } from 'lucide-react';
import {
  DateWithPopover,
  getActivityTypeLabel,
  Timeline,
  TimelineActivitiesToggle,
  TimelineActivitiesVisibilityProvider,
  TimelineItemExpandable,
  TimelineItemPlain,
  TimelineSection,
  SubmissionActionsDropdown,
  useDeploymentConfig,
  useTimelineActivitiesVisibility,
  ui,
} from '@curvenote/scms-core';
import type { Workflow } from '@curvenote/scms-core';
import type {
  SubmissionDetailActivity,
  SubmissionDetailSiteContext,
  SubmissionDetailVersion,
} from './types.js';

type SubmissionVersionTimelineProps = {
  workflow: Workflow;
  submissionVersions: SubmissionDetailVersion[];
  activities: SubmissionDetailActivity[];
  canUpdateStatus: boolean;
  site: SubmissionDetailSiteContext;
  signature: string;
};

type TimelineEntry =
  | {
      kind: 'version';
      key: string;
      date: string;
      version: SubmissionDetailVersion;
      versionNumber: number;
    }
  | {
      kind: 'activity';
      key: string;
      date: string;
      activity: SubmissionDetailActivity;
    };

function getPreviewUrl(baseUrl: string, versionId: string, signature: string) {
  return `${baseUrl}/previews/${versionId}?preview=${signature}`;
}

function sortEntriesNewestFirst(entries: TimelineEntry[]) {
  return [...entries].sort((a, b) =>
    a.date > b.date ? -1 : a.date < b.date ? 1 : a.kind === 'version' ? -1 : 1,
  );
}

function getActivityMessage(activity: SubmissionDetailActivity) {
  const activityData = activity.job_failure
    ? {
        transition_cancelled: true,
        job_type: activity.job_failure.job_type,
        error: activity.job_failure.error,
        job_id: activity.job_failure.job_id,
      }
    : undefined;
  const by = activity.activity_by.name?.trim();
  const label = getActivityTypeLabel(activity.activity_type, { data: activityData });
  return (
    <>
      {label}
      {by ? <> by {by}</> : null}
    </>
  );
}

function getActivityDetails(activity: SubmissionDetailActivity): ReactNode {
  if (activity.job_failure) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-700 dark:text-red-300">{activity.job_failure.error}</p>
        {activity.job_failure.build_url ? (
          <a
            href={activity.job_failure.build_url}
            className="text-sm underline text-red-800 dark:text-red-200"
            target="_blank"
            rel="noopener noreferrer"
          >
            View job details
          </a>
        ) : null}
      </div>
    );
  }

  if (activity.activity_type === 'SUBMISSION_KIND_CHANGE' && activity.kind) {
    return <p className="text-sm text-muted-foreground">New kind: {activity.kind}</p>;
  }

  if (activity.activity_type === 'SUBMISSION_DATE_CHANGE' && activity.date_published) {
    return <p className="text-sm text-muted-foreground">New date: {activity.date_published}</p>;
  }

  if (activity.activity_type === 'SUBMISSION_VERSION_STATUS_CHANGE' && activity.status) {
    return <p className="text-sm text-muted-foreground">New status: {activity.status}</p>;
  }

  return null;
}

function SubmissionActivityTimelineItem({ activity }: { activity: SubmissionDetailActivity }) {
  const date = (
    <DateWithPopover
      date={activity.date_created}
      dateCreated={activity.date_created}
      dateModified={activity.date_created}
    />
  );
  const details = getActivityDetails(activity);

  if (details == null) {
    return (
      <TimelineItemPlain
        muted
        icon={<Activity aria-hidden />}
        message={getActivityMessage(activity)}
        date={date}
      />
    );
  }

  return (
    <TimelineItemExpandable
      icon={<Activity aria-hidden />}
      message={getActivityMessage(activity)}
      date={date}
      className="text-muted-foreground"
    >
      {details}
    </TimelineItemExpandable>
  );
}

function SubmissionVersionTimelineItem({
  version,
  versionNumber,
  workflow,
  canUpdateStatus,
  previewUrl,
  onUpdateStatus,
}: {
  version: SubmissionDetailVersion;
  versionNumber: number;
  workflow: Workflow;
  canUpdateStatus: boolean;
  previewUrl: string;
  onUpdateStatus: (version: SubmissionDetailVersion, nextStatus: string) => void;
}) {
  const date = (
    <DateWithPopover
      date={version.date_created}
      dateCreated={version.date_created}
      dateModified={version.date_created}
    />
  );
  const message = (
    <span className="flex flex-wrap gap-1.5 items-center min-w-0">
      <span className="font-medium">Version {versionNumber}</span>
      <span className="truncate text-muted-foreground">
        submitted by {version.submitted_by.name}
      </span>
    </span>
  );
  const trailing = (
    <SubmissionActionsDropdown
      compact
      workflow={workflow}
      keyStub={version.id}
      workflowStateName={version.status}
      transition={version.transition}
      previewUrl={previewUrl}
      buildUrl={version.links.build}
      onClickAction={(next) => onUpdateStatus(version, next)}
      canUpdateStatus={canUpdateStatus}
    />
  );

  return (
    <TimelineItemExpandable
      icon={<FileText aria-hidden />}
      message={message}
      date={date}
      trailing={trailing}
    >
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <div className="font-medium">{version.site_work.title}</div>
          {version.site_work.description ? (
            <p className="mt-1 text-muted-foreground">{version.site_work.description}</p>
          ) : null}
          {version.site_work.authors.length > 0 ? (
            <p className="mt-1 text-muted-foreground">
              {version.site_work.authors.map((author) => author.name).join(', ')}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex gap-1 items-center text-primary hover:underline"
          >
            Preview version <ExternalLink className="size-3" aria-hidden />
          </a>
          {version.links.build ? (
            <a
              href={version.links.build}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex gap-1 items-center text-primary hover:underline"
            >
              Build details <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : null}
          {version.date_published ? (
            <span className="text-muted-foreground">Published {version.date_published}</span>
          ) : null}
        </div>
      </div>
    </TimelineItemExpandable>
  );
}

function SubmissionVersionTimelineInner({
  workflow,
  submissionVersions,
  activities,
  canUpdateStatus,
  site,
  signature,
}: SubmissionVersionTimelineProps) {
  const fetcher = useFetcher();
  const config = useDeploymentConfig();
  const { showActivities } = useTimelineActivitiesVisibility();
  const baseUrl = config.renderServiceUrl || site.links.html || '';

  const activitiesByVersionId = useMemo(() => {
    const grouped = new Map<string, SubmissionDetailActivity[]>();
    const submissionLevel: SubmissionDetailActivity[] = [];
    const versionIdSet = new Set(submissionVersions.map((version) => version.id));
    const workVersionIdToSubmissionVersionId = new Map(
      submissionVersions.map((version) => [version.site_work.version_id, version.id]),
    );

    for (const activity of activities) {
      const directVersionId = activity.submission_version?.id;
      const workVersionId = directVersionId ? undefined : activity.work_version?.id;
      const versionId =
        directVersionId && versionIdSet.has(directVersionId)
          ? directVersionId
          : workVersionId
            ? workVersionIdToSubmissionVersionId.get(workVersionId)
            : undefined;

      if (!versionId) {
        submissionLevel.push(activity);
        continue;
      }

      const list = grouped.get(versionId) ?? [];
      list.push(activity);
      grouped.set(versionId, list);
    }

    for (const list of grouped.values()) {
      list.sort((a, b) =>
        a.date_created > b.date_created ? -1 : a.date_created < b.date_created ? 1 : 0,
      );
    }
    submissionLevel.sort((a, b) =>
      a.date_created > b.date_created ? -1 : a.date_created < b.date_created ? 1 : 0,
    );

    return { grouped, submissionLevel };
  }, [activities, submissionVersions]);

  function handleUpdateStatusSubmit(version: SubmissionDetailVersion, nextStatus: string) {
    if (!canUpdateStatus) return;

    setTimeout(() => {
      if (confirm(`Updating status from "${version.status}" to "${nextStatus}", are you sure?`)) {
        fetcher.submit(
          { submissionVersionId: version.id, status: nextStatus },
          { method: 'POST', action: `/app/sites/${site.name}/submissions` },
        );
      }
    }, 100);
  }

  return (
    <Timeline
      title="TIMELINE"
      titleClassName="text-sm font-medium uppercase tracking-wide"
      headerAction={<TimelineActivitiesToggle />}
    >
      {showActivities && activitiesByVersionId.submissionLevel.length > 0 ? (
        <TimelineSection
          label={<span className="text-sm text-muted-foreground">Submission activity</span>}
          icon={<Activity className="w-5 h-5 bg-background text-foreground/60" aria-hidden />}
        >
          {activitiesByVersionId.submissionLevel.map((activity) => (
            <SubmissionActivityTimelineItem key={activity.id} activity={activity} />
          ))}
        </TimelineSection>
      ) : null}
      {submissionVersions.map((version, index) => {
        const versionNumber = submissionVersions.length - index;
        const previewUrl = getPreviewUrl(baseUrl, version.id, signature);
        const versionEntries: TimelineEntry[] = [
          {
            kind: 'version',
            key: `version-${version.id}`,
            date: version.date_created,
            version,
            versionNumber,
          },
          ...(showActivities
            ? (activitiesByVersionId.grouped.get(version.id) ?? []).map((activity) => ({
                kind: 'activity' as const,
                key: `activity-${activity.id}`,
                date: activity.date_created,
                activity,
              }))
            : []),
        ];
        const label = (
          <span className="flex flex-wrap gap-2 items-center">
            <ui.VersionTagBadge tag={`v${versionNumber}`} titlePrefix="Submission version" />
            {version.tags?.map((tag) => (
              <ui.VersionTagBadge key={tag} tag={tag} titlePrefix="Version tag" />
            ))}
            <span className="text-sm text-muted-foreground">
              Submitted <DateWithPopover date={version.date_created} />
            </span>
          </span>
        );

        return (
          <TimelineSection key={version.id} label={label}>
            {sortEntriesNewestFirst(versionEntries).map((entry) => {
              if (entry.kind === 'activity') {
                return <SubmissionActivityTimelineItem key={entry.key} activity={entry.activity} />;
              }

              return (
                <SubmissionVersionTimelineItem
                  key={entry.key}
                  version={entry.version}
                  versionNumber={entry.versionNumber}
                  workflow={workflow}
                  canUpdateStatus={canUpdateStatus}
                  previewUrl={previewUrl}
                  onUpdateStatus={handleUpdateStatusSubmit}
                />
              );
            })}
          </TimelineSection>
        );
      })}
    </Timeline>
  );
}

export function SubmissionVersionTimeline(props: SubmissionVersionTimelineProps) {
  return (
    <TimelineActivitiesVisibilityProvider>
      <SubmissionVersionTimelineInner {...props} />
    </TimelineActivitiesVisibilityProvider>
  );
}
