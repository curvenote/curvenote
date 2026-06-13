import type { ReactNode } from 'react';
import { useState } from 'react';
import { GitBranch, Tag } from 'lucide-react';
import {
  cn,
  formatDate,
  formatDatetime,
  getStatusButtonClasses,
  getStatusDotClasses,
  ui,
} from '@curvenote/scms-core';
import type { VersionTimelineEntry } from '../$siteName.submissions.$submissionId.versions/db.server.js';
import { useSubmissionVersionTimeline } from './versionTimeline.js';

function TimelineRail() {
  // `w-px` renders to the right of its anchor; `-translate-x-1/2` shifts it
  // a half-pixel left so the rail's visual center sits exactly on the dot
  // center (dots are size-2.5 → center at left+5px).
  return (
    <span
      className="absolute left-[5px] top-2 bottom-0 w-px -translate-x-1/2 bg-border"
      aria-hidden
    />
  );
}

function TimelineSkeleton() {
  return (
    <div className="relative pt-1 pb-2 space-y-4">
      <TimelineRail />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex relative gap-3">
          <span className="relative z-10 mt-[3px] size-2.5 shrink-0 rounded-full bg-muted ring-2 ring-popover animate-pulse" />
          <div className="flex-1 space-y-2 min-w-0">
            <div className="w-24 h-3 rounded animate-pulse bg-muted" />
            <div className="w-16 h-3 rounded animate-pulse bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PublishedDate({ datePublished }: { datePublished?: string }) {
  if (datePublished) {
    return (
      <ui.Tooltip>
        <ui.TooltipTrigger asChild>
          <time className="text-xs font-medium text-foreground" dateTime={datePublished}>
            {formatDate(datePublished)}
          </time>
        </ui.TooltipTrigger>
        <ui.TooltipContent sideOffset={4}>
          Publication date · {formatDatetime(datePublished)}
        </ui.TooltipContent>
      </ui.Tooltip>
    );
  }

  return (
    <ui.Tooltip>
      <ui.TooltipTrigger asChild>
        <span className="text-xs font-normal text-muted-foreground">no publication date</span>
      </ui.TooltipTrigger>
      <ui.TooltipContent sideOffset={4}>
        Publication date — no publication date for this version
      </ui.TooltipContent>
    </ui.Tooltip>
  );
}

function TimelineRow({ entry }: { entry: VersionTimelineEntry }) {
  const activityDate = entry.date_modified ?? entry.date_created;
  const activityPrefix = entry.date_modified ? 'Updated' : 'Created';

  return (
    <div className="flex relative gap-3">
      <span
        className={cn(
          'relative z-10 mt-[3px] size-2.5 shrink-0 rounded-full border border-gray-300 ring-2 ring-popover dark:border-gray-600',
          getStatusDotClasses(entry.status),
        )}
        aria-hidden
      />
      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex flex-wrap gap-y-1 gap-x-2 items-center">
          <PublishedDate datePublished={entry.date_published} />
          {entry.tag ? (
            <ui.VersionTagBadge tag={entry.tag} icon={Tag} disableTooltip className="shrink-0" />
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
      </div>
    </div>
  );
}

function VersionTimelineContent({
  data,
  loading,
  error,
}: {
  data?: VersionTimelineEntry[];
  loading: boolean;
  error?: string;
}) {
  if (loading && !data?.length) {
    return <TimelineSkeleton />;
  }

  if (error && !data?.length) {
    return <p className="text-xs text-muted-foreground">{error}</p>;
  }

  if (!data?.length) {
    return <p className="text-xs text-muted-foreground">No versions</p>;
  }

  return (
    <div className="overflow-y-auto relative pt-1 pb-2 space-y-4 max-h-72">
      <TimelineRail />
      {data.map((entry) => (
        <TimelineRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

export function VersionTimelineHoverCard({
  siteName,
  submissionId,
  children,
  align = 'start',
  side = 'top',
}: {
  siteName: string;
  submissionId: string;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  const [open, setOpen] = useState(false);
  const { data, loading, error } = useSubmissionVersionTimeline(siteName, submissionId, { open });

  return (
    <ui.HoverCard open={open} onOpenChange={setOpen} openDelay={400} closeDelay={100}>
      <ui.HoverCardTrigger asChild>
        <span className="inline-flex cursor-default transition-[filter] duration-150 hover:brightness-[0.97] dark:hover:brightness-[1.06]">
          {children}
        </span>
      </ui.HoverCardTrigger>
      <ui.HoverCardContent align={align} side={side} sideOffset={8} className="w-80 p-3">
        <div className="mb-2 flex items-center gap-1.5 border-b border-border pb-2 text-xs font-semibold text-foreground">
          <GitBranch className="size-3.5 shrink-0" aria-hidden />
          <span>Versions</span>
          {data?.length != null && !loading ? (
            <span className="font-normal text-muted-foreground">({data.length})</span>
          ) : null}
        </div>
        <VersionTimelineContent data={data} loading={loading} error={error} />
        <ui.HoverCardArrow className="fill-popover" />
      </ui.HoverCardContent>
    </ui.HoverCard>
  );
}
