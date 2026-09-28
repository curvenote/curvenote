import type { LucideIcon } from 'lucide-react';
import { CircleUserRound, FilePlus2, Globe2 } from 'lucide-react';
import { cn, ui } from '@curvenote/scms-core';
import type { InboxHeadlineStats } from './db.server.js';
import { INBOX_PERIOD_LABELS, INBOX_PERIODS, type InboxPeriod } from './inboxParams.js';
import { InboxSectionCard, inboxTileClass } from './InboxSectionCard.js';

interface InboxHeadlineCardsProps {
  stats: InboxHeadlineStats;
  period: InboxPeriod;
  onPeriodChange: (period: InboxPeriod) => void;
}

const statCardSurface = cn('flex', inboxTileClass);

const statCountColumn = cn(
  'flex min-w-[5.5rem] shrink-0 flex-col items-center justify-center self-stretch border-r px-3 py-4',
  'border-border tabular-nums',
);

function StatCard({
  icon: Icon,
  iconClassName,
  title,
  periodLabel,
  value,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  periodLabel: string;
  value: number;
}) {
  return (
    <div className={statCardSurface}>
      <span className={statCountColumn}>
        <span className="text-3xl font-semibold tracking-tight text-foreground">
          {value.toLocaleString()}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-4 py-4">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full ring-1',
              iconClassName,
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="text-sm font-medium leading-snug text-foreground">{title}</span>
        </span>
        <span className="pl-10 text-xs text-muted-foreground">Last {periodLabel}</span>
      </span>
    </div>
  );
}

export function InboxHeadlineCards({ stats, period, onPeriodChange }: InboxHeadlineCardsProps) {
  const periodLabel = INBOX_PERIOD_LABELS[period].toLowerCase();

  return (
    <InboxSectionCard
      title="Overview"
      headerActions={
        <ui.ToggleGroup
          type="single"
          value={period}
          aria-label="Time period"
          className="justify-start rounded-sm border p-0.5"
          onValueChange={(value) => {
            if (!value) return;
            onPeriodChange(value as InboxPeriod);
          }}
        >
          {INBOX_PERIODS.map((option) => (
            <ui.ToggleGroupItem
              key={option}
              value={option}
              aria-label={INBOX_PERIOD_LABELS[option]}
              className={cn(
                'rounded-[calc(var(--radius)-2px)] px-3 text-sm data-[state=off]:bg-transparent',
                'data-[state=on]:border-primary/40 data-[state=on]:bg-primary/5 data-[state=on]:shadow-xs',
                'dark:data-[state=on]:bg-primary/10',
              )}
            >
              {INBOX_PERIOD_LABELS[option]}
            </ui.ToggleGroupItem>
          ))}
        </ui.ToggleGroup>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={FilePlus2}
          iconClassName="bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-400"
          title="New submissions"
          periodLabel={periodLabel}
          value={stats.newSubmissions}
        />
        <StatCard
          icon={Globe2}
          iconClassName="bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400"
          title="Published"
          periodLabel={periodLabel}
          value={stats.published}
        />
        <StatCard
          icon={CircleUserRound}
          iconClassName="bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:text-amber-400"
          title="Assigned to queue"
          periodLabel={periodLabel}
          value={stats.assignedInQueue}
        />
      </div>
    </InboxSectionCard>
  );
}
