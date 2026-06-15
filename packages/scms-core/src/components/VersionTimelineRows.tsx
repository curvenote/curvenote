import type { ReactNode } from 'react';
import type { VersionTimelineEntry, WorkVersionTimelineEntry } from '../types/versionTimeline.js';
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

function SubmissionVersionTimelineTag({ tag }: { tag?: string }) {
  if (!tag) {
    return <span className="w-7 shrink-0" aria-hidden />;
  }

  return (
    <span className="inline-flex h-4 w-7 shrink-0 items-center justify-center text-[10px] font-mono leading-none text-foreground/90">
      {tag}
    </span>
  );
}

function SubmissionVersionTimelineStatusChip({
  statusLabel,
  statusTags,
}: {
  statusLabel: string;
  statusTags?: string[];
}) {
  return (
    <span
      className={cn(
        'inline-flex h-4 shrink-0 items-center justify-center rounded-md ring-2 px-1.5 justify-self-end',
        getStatusRingClasses(statusTags),
      )}
    >
      <span className="text-[10px] leading-none text-foreground/90">{statusLabel}</span>
    </span>
  );
}

function TimelineRowMetaGrid({
  date,
  tag,
  status,
  wideDate = false,
}: {
  date: ReactNode;
  tag?: ReactNode;
  status: ReactNode;
  wideDate?: boolean;
}) {
  return (
    <div
      className={cn(
        'grid min-h-4 items-center gap-x-2',
        wideDate
          ? 'grid-cols-[7.5rem_1.75rem_minmax(0,1fr)]'
          : 'grid-cols-[5.25rem_1.75rem_minmax(0,1fr)]',
      )}
    >
      <div className="min-w-0">{date}</div>
      {tag ?? <span className="w-7 shrink-0" aria-hidden />}
      <div className="flex min-w-0 justify-end">{status}</div>
    </div>
  );
}

function TimelineRowChipGrid({
  date,
  chips,
  wideDate = false,
}: {
  date: ReactNode;
  chips: ReactNode;
  wideDate?: boolean;
}) {
  return (
    <div
      className={cn(
        'grid min-h-4 items-center gap-x-2',
        wideDate ? 'grid-cols-[7.5rem_minmax(0,1fr)]' : 'grid-cols-[5.25rem_minmax(0,1fr)]',
      )}
    >
      <div className="min-w-0">{date}</div>
      <div className="flex min-w-0 flex-wrap justify-end gap-1">{chips}</div>
    </div>
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
      <TimelineRowMetaGrid
        date={<PublishedDate datePublished={entry.date_published} />}
        tag={<SubmissionVersionTimelineTag tag={entry.tag} />}
        status={
          <SubmissionVersionTimelineStatusChip
            statusLabel={entry.statusLabel}
            statusTags={entry.statusTags}
          />
        }
      />
      <p className="text-[11px] text-muted-foreground" title={formatDatetime(activityDate)}>
        {activityPrefix}: {formatDate(activityDate)}
      </p>
    </VersionTimelineRowShell>
  );
}

export function WorkVersionTimelineRow({
  entry,
  workId,
}: {
  entry: WorkVersionTimelineEntry;
  workId?: string;
}) {
  const submissionVersions = entry.submissionVersions ?? [];

  return (
    <VersionTimelineRowShell dotStatus={entry.draft ? 'DRAFT' : 'PUBLISHED'}>
      <TimelineRowChipGrid
        date={<CreatedDate dateCreated={entry.date_created} />}
        wideDate
        chips={submissionVersions.map((submissionVersion) => (
          <SubmissionVersionSiteChip
            key={submissionVersion.id}
            submissionVersion={submissionVersion}
            workId={workId}
          />
        ))}
      />
      <p className="text-[11px] text-muted-foreground" title={formatDatetime(entry.date_modified)}>
        Modified: {formatDate(entry.date_modified)}
      </p>
    </VersionTimelineRowShell>
  );
}
