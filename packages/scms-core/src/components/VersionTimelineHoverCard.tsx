import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Ellipsis, Timeline } from 'lucide-react';
import type {
  TrimmedVersionTimeline,
  VersionTimelineDisplayItem,
  VersionTimelineEntry,
  WorkVersionTimelineEntry,
} from '../types/versionTimeline.js';
import type { ClientExtensionCheckService as ExtensionCheckService } from '../modules/extensions/types.js';
import { useVersionTimeline } from '../hooks/useVersionTimeline.js';
import { SubmissionVersionTimelineRow, WorkVersionTimelineRow } from './VersionTimelineRows.js';
import { cn } from '../utils/cn.js';
import { HoverCard, HoverCardArrow, HoverCardContent, HoverCardTrigger } from './ui/hover-card.js';

export type { VersionTimelineEntry, WorkVersionTimelineEntry } from '../types/versionTimeline.js';

function TimelineSkeleton() {
  return (
    <div className="relative pt-1 pb-2 space-y-4">
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

function TimelineConnector({ dashed }: { dashed: boolean }) {
  return (
    <span
      className={cn(
        'absolute left-[5px] top-[14px] h-[calc(100%+1rem)] w-px -translate-x-1/2',
        dashed ? 'border-l border-dashed border-muted-foreground/40' : 'bg-border',
      )}
      aria-hidden
    />
  );
}

function VersionTimelineGapRow({ hiddenCount }: { hiddenCount: number }) {
  return (
    <div className="flex relative gap-3 py-0.5">
      <div className="relative z-10 flex flex-col items-center w-2.5 shrink-0 self-stretch">
        <span className="w-px flex-1 min-h-2 border-l border-dashed border-muted-foreground/40" />
        <Ellipsis className="size-3 shrink-0 text-muted-foreground/60" aria-hidden />
        <span className="w-px flex-1 min-h-2 border-l border-dashed border-muted-foreground/40" />
      </div>
      <p className="self-center text-[10px] text-muted-foreground">
        {hiddenCount} version{hiddenCount === 1 ? '' : 's'} hidden
      </p>
    </div>
  );
}

function connectorDashedAfter<T extends { id: string }>(
  items: VersionTimelineDisplayItem<T>[],
  index: number,
): boolean {
  if (index >= items.length - 1) return false;
  const current = items[index];
  const next = items[index + 1];
  return current.type === 'gap' || next.type === 'gap';
}

export function VersionTimelineContent<T extends { id: string }>({
  timeline,
  loading,
  error,
  renderRow,
}: {
  timeline?: TrimmedVersionTimeline<T>;
  loading: boolean;
  error?: string;
  renderRow: (entry: T) => ReactNode;
}) {
  const items = timeline?.items;

  if (loading && !items?.length) {
    return <TimelineSkeleton />;
  }

  if (error && !items?.length) {
    return <p className="text-xs text-muted-foreground">{error}</p>;
  }

  if (!items?.length) {
    return <p className="text-xs text-muted-foreground">No versions</p>;
  }

  return (
    <div className="overflow-y-auto relative pt-1 pb-2 space-y-4 max-h-72">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        if (item.type === 'gap') {
          return (
            <div key={`gap-${index}`} className="relative">
              {!isLast ? <TimelineConnector dashed={connectorDashedAfter(items, index)} /> : null}
              <VersionTimelineGapRow hiddenCount={item.hiddenCount} />
            </div>
          );
        }

        const dashedBelow = !isLast && connectorDashedAfter(items, index);

        return (
          <div key={item.version.id} className="relative">
            {!isLast ? <TimelineConnector dashed={dashedBelow} /> : null}
            {renderRow(item.version)}
          </div>
        );
      })}
    </div>
  );
}

function VersionTimelineHiddenFooter({
  hidden,
  seeAllHref,
}: {
  hidden: number;
  seeAllHref: string;
}) {
  if (hidden <= 0 || !seeAllHref) {
    return null;
  }

  return (
    <div className="mt-2 border-t border-border pt-2">
      <Link
        to={seeAllHref}
        className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
      >
        {hidden} version{hidden === 1 ? '' : 's'} hidden · click to see all
      </Link>
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
  contentClassName,
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
      <HoverCardContent
        align={align}
        side={side}
        sideOffset={8}
        className={cn(
          contentClassName ?? 'w-fit max-w-[min(20rem,calc(100vw-2rem))]',
          'p-3',
        )}
      >
        <div className="mb-2 flex items-center gap-1.5 border-b border-border pb-2 text-xs font-semibold text-foreground">
          <Timeline className="size-3.5 shrink-0" aria-hidden />
          <span>{title}</span>
          {data?.total != null && !loading ? (
            <span className="font-normal text-muted-foreground">({data.total})</span>
          ) : null}
        </div>
        <VersionTimelineContent
          timeline={data}
          loading={loading}
          error={error}
          renderRow={renderRow}
        />
        {data ? (
          <VersionTimelineHiddenFooter hidden={data.hidden} seeAllHref={data.seeAllHref} />
        ) : null}
        <HoverCardArrow className="fill-popover" />
      </HoverCardContent>
    </HoverCard>
  );
}

export type VersionTimelineHoverCardProps<T extends { id: string }> = {
  /** JSON resource URL returning a trimmed version timeline payload. */
  versionsUrl: string;
  children: ReactNode;
  renderRow: (entry: T) => ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  title?: string;
  contentClassName?: string;
};

export function SubmissionVersionTimelineHoverCard({
  versionsUrl,
  children,
  align,
  side,
  title,
}: Omit<VersionTimelineHoverCardProps<VersionTimelineEntry>, 'renderRow'>) {
  return (
    <VersionTimelineHoverCard<VersionTimelineEntry>
      versionsUrl={versionsUrl}
      align={align}
      side={side}
      title={title}
      renderRow={(entry) => <SubmissionVersionTimelineRow entry={entry} />}
    >
      {children}
    </VersionTimelineHoverCard>
  );
}

export function WorkVersionTimelineHoverCard({
  workId,
  versionsUrl,
  children,
  align,
  side,
  title,
  checkServices,
}: Omit<VersionTimelineHoverCardProps<WorkVersionTimelineEntry>, 'renderRow'> & {
  workId?: string;
  checkServices?: ExtensionCheckService[];
}) {
  return (
    <VersionTimelineHoverCard<WorkVersionTimelineEntry>
      versionsUrl={versionsUrl}
      align={align}
      side={side}
      title={title}
      contentClassName="w-fit max-w-[min(32rem,calc(100vw-2rem))]"
      renderRow={(entry) => (
        <WorkVersionTimelineRow entry={entry} workId={workId} checkServices={checkServices} />
      )}
    >
      {children}
    </VersionTimelineHoverCard>
  );
}
