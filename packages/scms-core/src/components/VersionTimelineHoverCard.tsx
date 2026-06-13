import type { ReactNode } from 'react';
import { useState } from 'react';
import { Timeline } from 'lucide-react';
import type { VersionTimelineEntry, WorkVersionTimelineEntry } from '../types/versionTimeline.js';
import { useVersionTimeline } from '../hooks/useVersionTimeline.js';
import { SubmissionVersionTimelineRow, WorkVersionTimelineRow } from './VersionTimelineRows.js';
import { HoverCard, HoverCardArrow, HoverCardContent, HoverCardTrigger } from './ui/hover-card.js';

export type { VersionTimelineEntry, WorkVersionTimelineEntry } from '../types/versionTimeline.js';

function TimelineRail() {
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

export function VersionTimelineContent<T extends { id: string }>({
  data,
  loading,
  error,
  renderRow,
}: {
  data?: T[];
  loading: boolean;
  error?: string;
  renderRow: (entry: T) => ReactNode;
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
        <div key={entry.id}>{renderRow(entry)}</div>
      ))}
    </div>
  );
}

export function VersionTimelineHoverCard<T extends { id: string }>({
  versionsUrl,
  children,
  renderRow,
  align = 'start',
  side = 'top',
  title = 'Versions',
}: VersionTimelineHoverCardProps<T>) {
  const [open, setOpen] = useState(false);
  const { data, loading, error } = useVersionTimeline<T>(versionsUrl, { open });

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={400} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span className="inline-flex cursor-default transition-[filter] duration-150 hover:brightness-[0.97] dark:hover:brightness-[1.06]">
          {children}
        </span>
      </HoverCardTrigger>
      <HoverCardContent align={align} side={side} sideOffset={8} className="w-80 p-3">
        <div className="mb-2 flex items-center gap-1.5 border-b border-border pb-2 text-xs font-semibold text-foreground">
          <Timeline className="size-3.5 shrink-0" aria-hidden />
          <span>{title}</span>
          {data?.length != null && !loading ? (
            <span className="font-normal text-muted-foreground">({data.length})</span>
          ) : null}
        </div>
        <VersionTimelineContent data={data} loading={loading} error={error} renderRow={renderRow} />
        <HoverCardArrow className="fill-popover" />
      </HoverCardContent>
    </HoverCard>
  );
}

export type VersionTimelineHoverCardProps<T extends { id: string }> = {
  /** JSON resource URL returning `{ versions: T[] }`. */
  versionsUrl: string;
  children: ReactNode;
  renderRow: (entry: T) => ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  title?: string;
};

export function SubmissionVersionTimelineHoverCard(
  props: Omit<VersionTimelineHoverCardProps<VersionTimelineEntry>, 'renderRow'>,
) {
  return (
    <VersionTimelineHoverCard<VersionTimelineEntry>
      {...props}
      renderRow={(entry) => <SubmissionVersionTimelineRow entry={entry} />}
    />
  );
}

export function WorkVersionTimelineHoverCard(
  props: Omit<VersionTimelineHoverCardProps<WorkVersionTimelineEntry>, 'renderRow'>,
) {
  return (
    <VersionTimelineHoverCard<WorkVersionTimelineEntry>
      {...props}
      renderRow={(entry) => <WorkVersionTimelineRow entry={entry} />}
    />
  );
}
