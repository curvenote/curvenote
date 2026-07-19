import { useMemo, type ReactNode } from 'react';
import { useFetcher } from 'react-router';
import { Activity, FileText } from 'lucide-react';
import {
  ActivityTimelineItem,
  CheckServiceRunTimelineItem,
  DateWithPopover,
  Timeline,
  TimelineActivitiesToggle,
  TimelineActivitiesVisibilityProvider,
  TimelineItemPlain,
  TimelineSection,
  SubmissionActionsDropdown,
  useDeploymentConfig,
  useTimelineActivitiesVisibility,
  ui,
} from '@curvenote/scms-core';
import type {
  ClientExtensionCheckService,
  TimelineCheckServiceRunRow,
  Workflow,
} from '@curvenote/scms-core';
import type {
  SubmissionDetailActivity,
  SubmissionDetailSiteContext,
  SubmissionDetailVersion,
} from './types.js';
import {
  getSubmissionTimelineSections,
  getSubmissionVersionBadgeTags,
  groupSubmissionActivitiesByVersion,
} from './SubmissionVersionTimeline.utils.js';

type SubmissionVersionTimelineProps = {
  workflow: Workflow;
  submissionVersions: SubmissionDetailVersion[];
  activities: SubmissionDetailActivity[];
  checkServiceRunsByWorkVersionId: Record<string, TimelineCheckServiceRunRow[]>;
  checkServices?: ClientExtensionCheckService[];
  canUpdateStatus: boolean;
  site: SubmissionDetailSiteContext;
  signature: string;
};

export type TimelineEntry =
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
    }
  | {
      kind: 'check-service-run';
      key: string;
      date: string;
      run: TimelineCheckServiceRunRow;
      version: SubmissionDetailVersion;
    };

const TIMELINE_ENTRY_KIND_RANK: Record<TimelineEntry['kind'], number> = {
  version: 0,
  'check-service-run': 1,
  activity: 2,
};

function getPreviewUrl(baseUrl: string, versionId: string, signature: string) {
  return `${baseUrl}/previews/${versionId}?preview=${signature}`;
}

export function sortEntriesNewestFirst(entries: TimelineEntry[]) {
  return [...entries].sort((a, b) => {
    if (a.date > b.date) return -1;
    if (a.date < b.date) return 1;
    return TIMELINE_ENTRY_KIND_RANK[a.kind] - TIMELINE_ENTRY_KIND_RANK[b.kind];
  });
}

function getActivityDetails(activity: SubmissionDetailActivity): ReactNode {
  const versionDate = activity.submission_version?.date_created;
  const versionDateNode = versionDate ? <DateWithPopover date={versionDate} /> : undefined;

  if (activity.job_failure) {
    return (
      <div className="space-y-3 text-sm">
        <ActivityDetailRow label="Error" value={activity.job_failure.error} />
        {activity.job_failure.job_type ? (
          <ActivityDetailRow label="Job type" value={activity.job_failure.job_type} />
        ) : null}
        {activity.job_failure.job_id ? (
          <ActivityDetailRow label="Job" value={activity.job_failure.job_id} />
        ) : null}
        {versionDateNode ? (
          <ActivityDetailRow label="Version date" value={versionDateNode} />
        ) : null}
        {activity.job_failure.build_url ? (
          <a
            href={activity.job_failure.build_url}
            className="inline-flex text-primary hover:underline"
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
    return <ActivityDetailRows rows={[['New kind', activity.kind]]} />;
  }

  if (activity.activity_type === 'SUBMISSION_DATE_CHANGE' && activity.date_published) {
    return (
      <ActivityDetailRows
        rows={[['New date', <DateWithPopover date={activity.date_published} />]]}
      />
    );
  }

  if (activity.activity_type === 'SUBMISSION_VERSION_STATUS_CHANGE' && activity.status) {
    return (
      <ActivityDetailRows
        rows={[
          ['New status', activity.status],
          ['Version date', versionDateNode],
        ]}
      />
    );
  }

  if (activity.activity_type === 'SUBMISSION_VERSION_TRANSITION_STARTED' && versionDateNode) {
    return <ActivityDetailRows rows={[['Version date', versionDateNode]]} />;
  }

  return null;
}

function ActivityDetailRows({ rows }: { rows: [string, ReactNode | undefined][] }) {
  const visibleRows = rows.filter(([, value]) => value != null && value !== '');
  if (visibleRows.length === 0) return null;
  return (
    <div className="space-y-2 text-sm">
      {visibleRows.map(([label, value]) => (
        <ActivityDetailRow key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function ActivityDetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8rem_1fr]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function getActivityLabelData(activity: SubmissionDetailActivity) {
  return activity.job_failure
    ? {
        transition_cancelled: true,
        job_type: activity.job_failure.job_type,
        error: activity.job_failure.error,
        job_id: activity.job_failure.job_id,
      }
    : undefined;
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
    <TimelineItemPlain
      icon={<FileText aria-hidden />}
      message={message}
      date={date}
      trailing={trailing}
    />
  );
}

function SubmissionVersionTimelineInner({
  workflow,
  submissionVersions,
  activities,
  checkServiceRunsByWorkVersionId,
  checkServices = [],
  canUpdateStatus,
  site,
  signature,
}: SubmissionVersionTimelineProps) {
  const fetcher = useFetcher();
  const config = useDeploymentConfig();
  const { showActivities } = useTimelineActivitiesVisibility();
  const baseUrl = config.renderServiceUrl || site.links.html || '';
  const checkServiceById = useMemo(
    () => Object.fromEntries(checkServices.map((service) => [service.id, service])),
    [checkServices],
  );

  const activitiesByVersionId = useMemo(
    () => groupSubmissionActivitiesByVersion(activities, submissionVersions),
    [activities, submissionVersions],
  );
  const timelineSections = useMemo(
    () =>
      getSubmissionTimelineSections(
        submissionVersions,
        showActivities ? activitiesByVersionId.submissionLevel : [],
      ),
    [activitiesByVersionId.submissionLevel, showActivities, submissionVersions],
  );

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
      {timelineSections.map((section) => {
        if (section.kind === 'submission-activity') {
          return (
            <TimelineSection
              key={section.key}
              label={<span className="text-sm text-muted-foreground">Submission activity</span>}
              icon={<Activity className="w-5 h-5 bg-background text-foreground/60" aria-hidden />}
            >
              <ActivityTimelineItem
                activity={section.activity}
                labelData={getActivityLabelData(section.activity)}
                details={getActivityDetails(section.activity)}
              />
            </TimelineSection>
          );
        }

        const { version, versionNumber } = section;
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
          ...(checkServiceRunsByWorkVersionId[version.site_work.version_id] ?? []).map((run) => ({
            kind: 'check-service-run' as const,
            key: `check-run-${run.id}`,
            date: run.date_created,
            run,
            version,
          })),
        ];
        const label = (
          <span className="flex flex-wrap gap-2 items-center">
            {getSubmissionVersionBadgeTags(version).map((tag) => (
              <ui.VersionTagBadge key={tag} tag={tag} titlePrefix="Version tag" />
            ))}
            <span className="text-sm text-muted-foreground">
              Submitted <DateWithPopover date={version.date_created} />
            </span>
          </span>
        );

        return (
          <TimelineSection key={section.key} label={label}>
            {sortEntriesNewestFirst(versionEntries).map((entry) => {
              if (entry.kind === 'activity') {
                return (
                  <ActivityTimelineItem
                    key={entry.key}
                    activity={entry.activity}
                    labelData={getActivityLabelData(entry.activity)}
                    details={getActivityDetails(entry.activity)}
                  />
                );
              }

              if (entry.kind === 'check-service-run') {
                return (
                  <CheckServiceRunTimelineItem
                    key={entry.key}
                    run={entry.run}
                    checkService={checkServiceById[entry.run.kind] ?? null}
                    basePath={`/app/works/${entry.version.site_work.id}`}
                    fallbackDetailsHref={`/app/works/${entry.version.site_work.id}/work-integrity`}
                  />
                );
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
