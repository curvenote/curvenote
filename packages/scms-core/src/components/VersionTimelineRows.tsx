import type { ReactNode } from 'react';
import { Tag } from 'lucide-react';
import type { VersionTimelineEntry, WorkVersionTimelineEntry } from '../types/versionTimeline.js';
import { formatDate, formatDatetime } from '../utils/formatDate.js';
import { getStatusButtonClasses, getStatusDotClasses } from '../utils/status.js';
import { cn } from '../utils/cn.js';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.js';
import { VersionTagBadge } from './ui/VersionTagBadge.js';
import { SubmissionVersionSiteChip } from './SubmissionVersionSiteChip.js';

export function VersionTimelineRowShell({
  dotStatus,
  children,
}: {
  dotStatus: string;
  children: ReactNode;
}) {
  return (
    <div className="flex relative gap-3">
      <span
        className={cn(
          'relative z-10 mt-[3px] size-2.5 shrink-0 rounded-full border border-gray-300 ring-2 ring-popover dark:border-gray-600',
          getStatusDotClasses(dotStatus),
        )}
        aria-hidden
      />
      <div className="flex-1 space-y-1 min-w-0">{children}</div>
    </div>
  );
}

function PublishedDate({ datePublished }: { datePublished?: string }) {
  if (datePublished) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <time className="text-xs font-medium text-foreground" dateTime={datePublished}>
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
        <span className="text-xs font-normal text-muted-foreground">no publication date</span>
      </TooltipTrigger>
      <TooltipContent sideOffset={4}>
        Publication date — no publication date for this version
      </TooltipContent>
    </Tooltip>
  );
}

function CreatedDate({ dateCreated }: { dateCreated: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-xs font-medium text-foreground">
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
      <div className="flex flex-wrap gap-y-1 gap-x-2 items-center">
        <PublishedDate datePublished={entry.date_published} />
        {entry.tag ? (
          <VersionTagBadge tag={entry.tag} icon={Tag} disableTooltip className="shrink-0" />
        ) : null}
        <span
          className={cn(
            getStatusButtonClasses(entry.status),
            'inline-flex items-center rounded-full px-2 py-[1px] text-[11px] leading-tight',
          )}
        >
          {entry.statusLabel}
        </span>
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
}: {
  entry: WorkVersionTimelineEntry;
  workId?: string;
}) {
  const submissionVersions = entry.submissionVersions ?? [];

  return (
    <VersionTimelineRowShell dotStatus={entry.draft ? 'DRAFT' : 'PUBLISHED'}>
      <div className="flex flex-wrap gap-y-1 gap-x-2 items-center">
        <CreatedDate dateCreated={entry.date_created} />
        {entry.tag ? (
          <VersionTagBadge tag={entry.tag} icon={Tag} disableTooltip className="shrink-0" />
        ) : null}
        {submissionVersions.map((submissionVersion) => (
          <SubmissionVersionSiteChip
            key={submissionVersion.id}
            submissionVersion={submissionVersion}
            workId={workId}
          />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground" title={formatDatetime(entry.date_modified)}>
        Modified: {formatDate(entry.date_modified)}
      </p>
    </VersionTimelineRowShell>
  );
}
