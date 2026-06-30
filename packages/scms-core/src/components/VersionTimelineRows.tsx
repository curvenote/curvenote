import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type {
  VersionTimelineEntry,
  WorkVersionTimelineCheckRun,
  WorkVersionTimelineEntry,
} from '../types/versionTimeline.js';
import type { ClientExtensionCheckService } from '../modules/extensions/types.js';
import {
  getCheckServiceRunServiceData,
  isCheckWorkListSummaryVisible,
} from '../modules/extensions/checks.js';
import { formatDate, formatDatetime } from '../utils/formatDate.js';
import { getStatusDotClasses, getStatusRingClasses } from '../utils/status.js';
import { cn } from '../utils/cn.js';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.js';
import { SubmissionVersionSiteChip } from './SubmissionVersionSiteChip.js';

export function VersionTimelineRowShell({
  dotStatus,
  children,
}: {
  dotStatus: string;
  children: ReactNode;
}) {
  return (
    <div className="flex relative gap-3 items-start">
      <span
        className={cn(
          'relative z-10 mt-[3px] size-2.5 shrink-0 rounded-full border border-gray-300 ring-2 ring-popover dark:border-gray-600',
          getStatusDotClasses(dotStatus),
        )}
        aria-hidden
      />
      <div className="flex-1 space-y-1 min-w-0 pt-px">{children}</div>
    </div>
  );
}

function PublishedDate({ datePublished }: { datePublished?: string }) {
  if (datePublished) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <time
            className="inline-flex h-4 items-center text-xs font-medium leading-none text-foreground"
            dateTime={datePublished}
          >
            {formatDate(datePublished)}
          </time>
        </TooltipTrigger>
        <TooltipContent sideOffset={4}>
          Publication date · {formatDatetime(datePublished)}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex h-4 items-center text-xs font-normal leading-none text-muted-foreground">
          no date
        </span>
      </TooltipTrigger>
      <TooltipContent sideOffset={4}>Publication date — no date for this version</TooltipContent>
    </Tooltip>
  );
}

function SubmissionVersionTimelineChip({
  tag,
  statusLabel,
  statusTags,
}: {
  tag?: string;
  statusLabel: string;
  statusTags?: string[];
}) {
  return (
    <span
      className={cn(
        'inline-flex h-4 shrink-0 items-center justify-center gap-0.5 rounded-md ring-2 px-1',
        getStatusRingClasses(statusTags),
      )}
    >
      {tag ? (
        <>
          <span className="text-[10px] font-mono leading-none text-foreground/90">{tag}</span>
          <span className="w-px h-3 bg-border/80 shrink-0" aria-hidden />
        </>
      ) : null}
      <span className="text-[10px] leading-none text-foreground/90">{statusLabel}</span>
    </span>
  );
}

function CreatedDate({ dateCreated }: { dateCreated: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex h-4 items-center text-xs font-medium leading-none text-foreground">
          Created: <time dateTime={dateCreated}>{formatDate(dateCreated)}</time>
        </span>
      </TooltipTrigger>
      <TooltipContent sideOffset={4}>Created · {formatDatetime(dateCreated)}</TooltipContent>
    </Tooltip>
  );
}

export function SubmissionVersionTimelineRow({ entry }: { entry: VersionTimelineEntry }) {
  const activityDate = entry.date_modified ?? entry.date_created;
  const activityPrefix = entry.date_modified ? 'Updated' : 'Created';

  return (
    <VersionTimelineRowShell dotStatus={entry.status}>
      <div className="flex flex-wrap gap-x-1.5 gap-y-1 items-center min-h-4">
        <PublishedDate datePublished={entry.date_published} />
        <SubmissionVersionTimelineChip
          tag={entry.tag}
          statusLabel={entry.statusLabel}
          statusTags={entry.statusTags}
        />
      </div>
      <p className="text-[11px] text-muted-foreground" title={formatDatetime(activityDate)}>
        {activityPrefix}: {formatDate(activityDate)}
      </p>
    </VersionTimelineRowShell>
  );
}

export function WorkVersionTimelineRow({
  entry,
  workId,
  checkServices = [],
}: {
  entry: WorkVersionTimelineEntry;
  workId?: string;
  checkServices?: ClientExtensionCheckService[];
}) {
  const submissionVersions = entry.submissionVersions ?? [];
  const serviceById = new Map(checkServices.map((service) => [service.id, service]));
  const checkRuns = (entry.checkRuns ?? [])
    .map((run) => ({
      run,
      service: serviceById.get(run.kind),
      metadata: getCheckServiceRunServiceData(run),
    }))
    .filter(
      (
        summary,
      ): summary is {
        run: WorkVersionTimelineCheckRun;
        service: ClientExtensionCheckService;
        metadata: unknown;
      } =>
        summary.service != null && isCheckWorkListSummaryVisible(summary.service, summary.metadata),
    );

  return (
    <VersionTimelineRowShell dotStatus={entry.draft ? 'DRAFT' : 'PUBLISHED'}>
      <div className="flex flex-wrap gap-x-1.5 gap-y-1 items-center min-h-4">
        <CreatedDate dateCreated={entry.date_created} />
        {submissionVersions.map((submissionVersion) => (
          <SubmissionVersionSiteChip
            key={submissionVersion.id}
            submissionVersion={submissionVersion}
            workId={workId}
          />
        ))}
        {checkRuns.map(({ run, service, metadata }) => {
          const SummaryComponent = service.workListSummaryComponent;
          if (!SummaryComponent) return null;
          const chip = (
            <span className="inline-flex h-5 max-w-full shrink-0 items-center gap-1 rounded-md border border-border bg-background px-1.5 text-[10px] text-foreground shadow-sm">
              <SummaryComponent
                compact
                metadata={metadata}
                checkRunId={run.id}
                workVersionId={run.work_version_id}
                checkServiceId={service.id}
                checkServiceName={service.name}
                checkRunDateModified={run.date_modified}
              />
            </span>
          );
          return (
            <Tooltip key={run.id}>
              <TooltipTrigger asChild>
                {workId ? (
                  <Link
                    to={`/app/works/${workId}/checks`}
                    className="inline-flex min-w-0 items-center transition-opacity hover:opacity-80"
                    aria-label={`${service.name} check summary`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {chip}
                  </Link>
                ) : (
                  <span className="inline-flex min-w-0 items-center cursor-default">{chip}</span>
                )}
              </TooltipTrigger>
              <TooltipContent sideOffset={4}>
                <span className="font-medium">{service.name}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · Check run · {formatDatetime(run.date_created)}
                </span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground" title={formatDatetime(entry.date_modified)}>
        Modified: {formatDate(entry.date_modified)}
      </p>
    </VersionTimelineRowShell>
  );
}
