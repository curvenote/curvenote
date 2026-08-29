import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRightLeft,
  FilePlus2,
  GitBranchPlus,
  Globe2,
  Shapes,
  type LucideIcon,
} from 'lucide-react';
import { cn, formatDate, formatToNow, getActivityTypeLabel } from '@curvenote/scms-core';
import type { InboxActivityItem, InboxActivityPage } from './db.server.js';
import { INBOX_ACTIVITY_PAGE_SIZE } from './inboxParams.js';
import { InboxExpandLink, InboxSectionCard, inboxTileClass } from './InboxSectionCard.js';

interface InboxActivityFeedProps {
  siteName: string;
  initialPage: InboxActivityPage;
}

const activityTileSurface = cn('flex', inboxTileClass);

const activityIconColumn = cn(
  'flex w-[4.25rem] shrink-0 flex-col items-center justify-center self-stretch border-r px-2 py-3',
  'border-border',
);

const activityTimeColumn = cn(
  'hidden w-[6.5rem] shrink-0 flex-col justify-center self-stretch border-l px-3 py-3 text-right sm:flex',
  'border-border tabular-nums',
);

type ActivityVisual = {
  icon: LucideIcon;
  iconClassName: string;
};

function activityVisual(activity: InboxActivityItem): ActivityVisual {
  switch (activity.activity_type) {
    case 'NEW_SUBMISSION':
    case 'SUBMISSION_VERSION_ADDED':
      return {
        icon: FilePlus2,
        iconClassName: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-400',
      };
    case 'SUBMISSION_VERSION_STATUS_CHANGE':
    case 'SUBMISSION_VERSION_TRANSITION_STARTED':
      if (activity.status === 'PUBLISHED' || activity.status === 'ACCEPTED') {
        return {
          icon: Globe2,
          iconClassName:
            'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400',
        };
      }
      if (activity.status === 'REJECTED' || activity.status === 'REMOVED') {
        return {
          icon: ArrowRightLeft,
          iconClassName: 'bg-red-500/10 text-red-700 ring-red-500/20 dark:text-red-400',
        };
      }
      return {
        icon: ArrowRightLeft,
        iconClassName: 'bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:text-amber-400',
      };
    case 'SUBMISSION_KIND_CHANGE':
      return {
        icon: Shapes,
        iconClassName: 'bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:text-amber-400',
      };
    case 'SUBMISSION_DATE_CHANGE':
      return {
        icon: Globe2,
        iconClassName: 'bg-stone-500/10 text-stone-700 ring-stone-500/20 dark:text-stone-400',
      };
    default:
      return {
        icon: GitBranchPlus,
        iconClassName: 'bg-primary/10 text-primary ring-primary/20',
      };
  }
}

function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function InboxActivityItemRow({
  activity,
  siteName,
}: {
  activity: InboxActivityItem;
  siteName: string;
}) {
  const label = getActivityTypeLabel(activity.activity_type, {
    data: activity.data,
    transition: activity.transition,
  });
  const { icon: Icon, iconClassName } = activityVisual(activity);
  const submissionHref = activity.submission
    ? `/app/sites/${encodeURIComponent(siteName)}/submissions/${encodeURIComponent(activity.submission.id)}`
    : undefined;

  const content = (
    <>
      <span className={activityIconColumn}>
        <span
          className={cn(
            'flex size-9 items-center justify-center rounded-full ring-1',
            iconClassName,
          )}
        >
          <Icon className="size-4" strokeWidth={1.75} aria-hidden />
        </span>
      </span>

      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-3">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium leading-snug text-foreground">{label}</span>
          {activity.status &&
          (activity.activity_type === 'SUBMISSION_VERSION_STATUS_CHANGE' ||
            activity.activity_type === 'SUBMISSION_VERSION_TRANSITION_STARTED') ? (
            <span className="inline-flex rounded-sm border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/80">
              {formatStatusLabel(activity.status)}
            </span>
          ) : null}
        </span>

        {activity.submission ? (
          <span className="truncate text-sm text-foreground/90">{activity.submission.title}</span>
        ) : null}

        <span className="text-xs text-muted-foreground">
          {activity.activity_by.name}
          <span className="sm:hidden">
            {' '}
            · {formatToNow(activity.date_created, { addSuffix: true })}
          </span>
        </span>
      </span>

      <span className={activityTimeColumn}>
        <span className="text-sm font-medium text-foreground">
          {formatToNow(activity.date_created, { addSuffix: true })}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDate(activity.date_created, 'HH:mm MMM d')}
        </span>
      </span>
    </>
  );

  if (submissionHref) {
    return (
      <Link
        to={submissionHref}
        className={cn(
          activityTileSurface,
          'group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        )}
      >
        {content}
      </Link>
    );
  }

  return <article className={activityTileSurface}>{content}</article>;
}

function activityFeedUrl(siteName: string, offset: number, limit: number) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  return `/app/sites/${encodeURIComponent(siteName)}/inbox/activity?${params}`;
}

export function InboxActivityFeed({ siteName, initialPage }: InboxActivityFeedProps) {
  const [activities, setActivities] = useState(initialPage.items);
  const [hasMore, setHasMore] = useState(initialPage.hasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(undefined);

    try {
      const response = await fetch(
        activityFeedUrl(siteName, activities.length, INBOX_ACTIVITY_PAGE_SIZE),
        { headers: { Accept: 'application/json' } },
      );

      if (!response.ok) {
        throw new Error(`Failed to load activity (${response.status})`);
      }

      const body = (await response.json()) as {
        activities?: InboxActivityItem[];
        hasMore?: boolean;
      };

      if (!body.activities || !Array.isArray(body.activities)) {
        throw new Error('Invalid activity response');
      }

      const nextActivities = body.activities;
      setActivities((current) => [...current, ...nextActivities]);
      setHasMore(Boolean(body.hasMore));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load more activity');
    } finally {
      setLoading(false);
    }
  }, [activities.length, hasMore, loading, siteName]);

  return (
    <InboxSectionCard title="Activity" description="Recent submission activity across the site.">
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="space-y-2">
          {activities.map((activity) => (
            <InboxActivityItemRow key={activity.id} activity={activity} siteName={siteName} />
          ))}
        </div>
      )}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {hasMore ? (
        <InboxExpandLink disabled={loading} onClick={() => void loadMore()}>
          {loading ? 'Loading…' : 'Show more'}
        </InboxExpandLink>
      ) : null}
    </InboxSectionCard>
  );
}
