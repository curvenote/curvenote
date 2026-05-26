import type { ReactNode } from 'react';
import { useState } from 'react';
import * as HoverCard from '@radix-ui/react-hover-card';
import { GitBranch, Tag } from 'lucide-react';
import {
  cn,
  formatDate,
  formatDatetime,
  formatToNow,
  getStatusButtonClasses,
  getStatusDotClasses,
  ui,
} from '@curvenote/scms-core';
import type { VersionTimelineEntry } from '../$siteName.submissions.$submissionId.versions/db.server.js';
import { useSubmissionVersionTimeline } from './versionTimeline.js';

const floatingPanelShadowClass =
  'shadow-[0_1px_3px_rgba(27,31,36,0.08),0_8px_24px_rgba(140,149,159,0.2)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.5)]';

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
    <div className="relative space-y-4 pt-1 pb-2">
      <TimelineRail />
      {[0, 1, 2].map((i) => (
        <div key={i} className="relative flex gap-3">
          <span className="relative z-10 mt-[3px] size-2.5 shrink-0 rounded-full bg-muted ring-2 ring-popover animate-pulse" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-24 rounded bg-muted animate-pulse" />
            <div className="h-3 w-16 rounded bg-muted animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineRow({ entry }: { entry: VersionTimelineEntry }) {
  return (
    <div className="relative flex gap-3">
      <span
        className={cn(
          'relative z-10 mt-[3px] size-2.5 shrink-0 rounded-full border border-gray-300 ring-2 ring-popover dark:border-gray-600',
          getStatusDotClasses(entry.status),
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <time
            className="text-xs font-medium text-foreground"
            dateTime={entry.date_created}
            title={formatDatetime(entry.date_created)}
          >
            {formatDate(entry.date_created)}
          </time>
          {entry.tag ? (
            <ui.VersionTagBadge
              tag={entry.tag}
              icon={Tag}
              disableTooltip
              className="shrink-0"
            />
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
        {entry.date_published ? (
          <p className="text-[11px] text-muted-foreground">
            Published {formatToNow(entry.date_published, { addSuffix: true })}
          </p>
        ) : null}
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
    <div className="relative max-h-72 space-y-4 overflow-y-auto pt-1 pb-2">
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
    <HoverCard.Root open={open} onOpenChange={setOpen} openDelay={400} closeDelay={100}>
      <HoverCard.Trigger asChild>
        <span className="inline-flex cursor-default transition-[filter] duration-150 hover:brightness-[0.97] dark:hover:brightness-[1.06]">
          {children}
        </span>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          align={align}
          side={side}
          sideOffset={8}
          className={cn(
            'z-50 w-80 rounded-md border border-border bg-popover p-3 text-popover-foreground outline-hidden',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
            'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
            floatingPanelShadowClass,
          )}
        >
          <div className="mb-2 flex items-center gap-1.5 border-b border-border pb-2 text-xs font-semibold text-foreground">
            <GitBranch className="size-3.5 shrink-0" aria-hidden />
            <span>Versions</span>
            {data?.length != null && !loading ? (
              <span className="font-normal text-muted-foreground">({data.length})</span>
            ) : null}
          </div>
          <VersionTimelineContent data={data} loading={loading} error={error} />
          <HoverCard.Arrow className="fill-popover" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
