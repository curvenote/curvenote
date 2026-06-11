import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { cn, formatToNow, ui } from '@curvenote/scms-core';
import type { SiteQueueInfo } from '../$siteName.submissions._index/db.server.js';
import {
  formatCategoryTagLabel,
  QueueAccessIndicator,
} from '../$siteName.submissions._index/CategoryTagBadge.js';
import {
  INBOX_QUEUE_COLLAPSED_ROWS,
  INBOX_QUEUE_SORT_DEFAULT,
  INBOX_QUEUE_SORT_LABELS,
  INBOX_QUEUE_SORTS,
  type InboxQueueSort,
} from './inboxQueueParams.js';
import { useInboxQueueStats } from './useInboxQueueStats.js';
import { InboxExpandLink, InboxSectionCard, inboxTileClass } from './InboxSectionCard.js';

interface InboxQueueTilesProps {
  siteName: string;
  queues: readonly SiteQueueInfo[];
  queuesEnabled: boolean;
  sort: InboxQueueSort;
  onSortChange: (sort: InboxQueueSort) => void;
}

function CountSkeleton() {
  return <span className="inline-block h-5 w-10 rounded bg-muted animate-pulse" aria-hidden />;
}

function AgeSkeleton() {
  return <span className="inline-block h-4 w-16 rounded bg-muted animate-pulse" aria-hidden />;
}

function formatMaxAge(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  if (seconds < 60) return '< 1 min';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hr`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
}

/** Match Tailwind `sm:` / `xl:` breakpoints used by the queue tile grid. */
function useQueueGridColumns() {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      if (width >= 1280) {
        setColumns(3);
      } else if (width >= 640) {
        setColumns(2);
      } else {
        setColumns(1);
      }
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return columns;
}

export function InboxQueueTiles({
  siteName,
  queues,
  queuesEnabled,
  sort,
  onSortChange,
}: InboxQueueTilesProps) {
  const [showAllQueues, setShowAllQueues] = useState(false);
  const gridColumns = useQueueGridColumns();
  const {
    data: stats,
    loading,
    error,
  } = useInboxQueueStats(siteName, {
    enabled: queuesEnabled && queues.length > 0,
  });

  const sortedQueues = useMemo(() => {
    const entries = queues.map((queue) => {
      const row = stats?.byQueue[queue.name];
      return {
        ...queue,
        count: row?.count,
        maxAgeSeconds: row?.maxAgeSeconds ?? null,
        oldestAt: row?.oldestAt ?? null,
      };
    });

    const copy = [...entries];
    switch (sort) {
      case 'count':
        copy.sort((a, b) => (b.count ?? -1) - (a.count ?? -1) || a.name.localeCompare(b.name));
        break;
      case 'maxAge':
        copy.sort(
          (a, b) =>
            (b.maxAgeSeconds ?? -1) - (a.maxAgeSeconds ?? -1) || a.name.localeCompare(b.name),
        );
        break;
      case 'name':
      default:
        copy.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return copy;
  }, [queues, sort, stats]);

  const collapsedLimit = gridColumns * INBOX_QUEUE_COLLAPSED_ROWS;
  const hasHiddenQueues = sortedQueues.length > collapsedLimit;
  const visibleQueues = useMemo(() => {
    if (showAllQueues || !hasHiddenQueues) {
      return sortedQueues;
    }
    return sortedQueues.slice(0, collapsedLimit);
  }, [collapsedLimit, hasHiddenQueues, showAllQueues, sortedQueues]);

  if (!queuesEnabled) {
    return (
      <InboxSectionCard title="Queues" description="Current workload by queue.">
        <p className="text-sm text-muted-foreground">
          Queue tracking is not enabled for this site.
        </p>
      </InboxSectionCard>
    );
  }

  if (queues.length === 0) {
    return (
      <InboxSectionCard title="Queues" description="Current workload by queue.">
        <p className="text-sm text-muted-foreground">No queues have submissions yet.</p>
      </InboxSectionCard>
    );
  }

  return (
    <InboxSectionCard
      title="Queues"
      description="Current workload by queue. Counts and wait times load in the background."
      headerActions={
        <div className="flex items-center gap-2">
          <label htmlFor="inbox-queue-sort" className="text-sm text-muted-foreground">
            Sort
          </label>
          <ui.Select
            value={sort}
            onValueChange={(value) =>
              onSortChange((value as InboxQueueSort) || INBOX_QUEUE_SORT_DEFAULT)
            }
          >
            <ui.SelectTrigger id="inbox-queue-sort" className="w-[11rem]">
              <ui.SelectValue />
            </ui.SelectTrigger>
            <ui.SelectContent>
              {INBOX_QUEUE_SORTS.map((option) => (
                <ui.SelectItem key={option} value={option}>
                  {INBOX_QUEUE_SORT_LABELS[option]}
                </ui.SelectItem>
              ))}
            </ui.SelectContent>
          </ui.Select>
        </div>
      }
    >
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleQueues.map((queue) => (
          <Link
            key={queue.name}
            to={`/app/sites/${encodeURIComponent(siteName)}/submissions?queues=${encodeURIComponent(queue.name)}`}
            className={cn(
              'group flex',
              inboxTileClass,
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            )}
          >
            <span
              className={cn(
                'flex min-w-[4.5rem] shrink-0 flex-col items-center justify-center gap-1 self-stretch border-r px-3 py-3',
                'border-gray-200 tabular-nums dark:border-gray-700',
              )}
            >
              {loading && queue.count === undefined ? (
                <CountSkeleton />
              ) : (
                <span className="text-xl font-semibold text-foreground">
                  {(queue.count ?? 0).toLocaleString()}
                </span>
              )}
              <QueueAccessIndicator staff={queue.staff} className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-3">
              <span className="truncate text-sm font-medium leading-snug text-foreground">
                {formatCategoryTagLabel(queue.name)}
              </span>
              <span className="text-xs text-muted-foreground">
                Max time in queue:{' '}
                {loading && queue.maxAgeSeconds == null && queue.count === undefined ? (
                  <AgeSkeleton />
                ) : (
                  <span className="font-medium text-foreground/80">
                    {formatMaxAge(queue.maxAgeSeconds)}
                    {queue.oldestAt ? (
                      <span className="font-normal text-muted-foreground">
                        {' '}
                        ({formatToNow(queue.oldestAt, { addSuffix: true })})
                      </span>
                    ) : null}
                  </span>
                )}
              </span>
            </span>
          </Link>
        ))}
      </div>

      {hasHiddenQueues ? (
        showAllQueues ? (
          <InboxExpandLink onClick={() => setShowAllQueues(false)}>Show less</InboxExpandLink>
        ) : (
          <InboxExpandLink onClick={() => setShowAllQueues(true)}>
            Show all ({sortedQueues.length.toLocaleString()})
          </InboxExpandLink>
        )
      ) : null}
    </InboxSectionCard>
  );
}
