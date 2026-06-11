import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { ChevronDown } from 'lucide-react';
import { cn, ui } from '@curvenote/scms-core';
import type { SiteQueueInfo } from './db.server.js';
import { readListingCsvParam, setListingCsvParam } from './listingParams.js';
import { formatCategoryTagLabel, QueueAccessIndicator } from './CategoryTagBadge.js';
import { useQueueCounts } from './queueCounts.js';

interface SubmissionsQueueFilterProps {
  siteName: string;
  queues: readonly SiteQueueInfo[];
  className?: string;
}

function CountSkeleton() {
  return <span className="inline-block h-4 w-8 rounded bg-muted animate-pulse" aria-hidden />;
}

function QueueCount({ value, loading }: { value: number | undefined; loading: boolean }) {
  if (loading) {
    return <CountSkeleton />;
  }
  if (value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span>{value.toLocaleString()}</span>;
}

/**
 * Single-select queue picker with a multi-column tile panel and lazy counts.
 */
export function SubmissionsQueueFilter({
  siteName,
  queues,
  className,
}: SubmissionsQueueFilterProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const selected = readListingCsvParam(searchParams, 'queues');
  const current = selected[0] ?? '';
  const { data: counts, loading: countsLoading } = useQueueCounts(siteName, { open });

  if (queues.length === 0) return null;

  const handleSelect = (queue: string) => {
    setSearchParams((prev) => setListingCsvParam(prev, 'queues', queue ? [queue] : []), {
      replace: false,
      preventScrollReset: true,
    });
    setOpen(false);
  };

  const summaryLabel = current ? formatCategoryTagLabel(current) : 'Any';

  return (
    <ui.Popover open={open} onOpenChange={setOpen}>
      <ui.PopoverTrigger asChild>
        <ui.Button
          variant="action"
          size="sm"
          className={cn(
            'gap-1.5 whitespace-nowrap font-normal',
            current && 'border-primary/40 bg-primary/5 dark:border-primary/40 dark:bg-primary/10',
            className,
          )}
          aria-label={`Queue: ${summaryLabel}`}
        >
          <span>
            Queue: <span className="font-medium">{summaryLabel}</span>
          </span>
          <ChevronDown className="size-3.5 opacity-60" />
        </ui.Button>
      </ui.PopoverTrigger>
      <ui.PopoverContent align="start" className="w-[min(42rem,92vw)] p-0">
        <div className="border-b border-border px-3 py-2">
          <p className="text-sm font-semibold text-foreground">Queue</p>
        </div>
        <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
          <AnyTile isSelected={current === ''} onSelect={() => handleSelect('')} />
          <div className="mt-2 grid grid-cols-2 gap-2 xl:grid-cols-3">
            {queues.map((entry) => (
              <QueueTile
                key={entry.name}
                staff={entry.staff}
                isSelected={entry.name === current}
                count={counts?.byQueue[entry.name]}
                countsLoading={countsLoading}
                label={formatCategoryTagLabel(entry.name)}
                title={formatCategoryTagLabel(entry.name)}
                onSelect={() => handleSelect(entry.name)}
              />
            ))}
          </div>
        </div>
      </ui.PopoverContent>
    </ui.Popover>
  );
}

function AnyTile({ isSelected, onSelect }: { isSelected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center rounded-md border px-3 py-2 text-left text-sm',
        'border-border/70 bg-stone-50/90 transition-[background-color,border-color,box-shadow] duration-150',
        'hover:border-stone-300 hover:bg-stone-100 hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        'dark:border-stone-700 dark:bg-stone-900/50',
        'dark:hover:border-stone-600 dark:hover:bg-stone-800 dark:hover:shadow-md dark:hover:shadow-black/20',
        isSelected &&
          'border-primary/50 bg-primary/5 ring-1 ring-primary/20 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/15',
      )}
      onClick={onSelect}
    >
      Any
    </button>
  );
}

function QueueTile({
  staff = false,
  isSelected,
  count,
  countsLoading,
  label,
  title,
  onSelect,
}: {
  staff?: boolean;
  isSelected: boolean;
  count: number | undefined;
  countsLoading: boolean;
  label: string;
  title?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      className={cn(
        'group flex w-full items-stretch overflow-hidden rounded-md border text-left text-sm',
        'border-border/70 bg-stone-50/90 transition-[background-color,border-color,box-shadow] duration-150',
        'hover:border-stone-300 hover:bg-stone-100 hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        'dark:border-stone-700 dark:bg-stone-900/50',
        'dark:hover:border-stone-600 dark:hover:bg-stone-800 dark:hover:shadow-md dark:hover:shadow-black/20',
        isSelected &&
          'border-primary/50 bg-primary/5 ring-1 ring-primary/20 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/15',
      )}
      onClick={onSelect}
    >
      <span
        className={cn(
          'flex min-w-[3rem] shrink-0 flex-col items-center justify-center gap-1 self-stretch border-r border-border/70 px-2 py-2',
          'tabular-nums text-sm font-semibold text-foreground',
          'dark:border-stone-700',
        )}
      >
        <QueueCount value={count} loading={countsLoading} />
        <QueueAccessIndicator staff={staff} className="size-3" />
      </span>
      <span className="flex min-w-0 flex-1 items-center self-stretch py-2 pl-1.5 pr-2 leading-snug">
        {label}
      </span>
    </button>
  );
}
