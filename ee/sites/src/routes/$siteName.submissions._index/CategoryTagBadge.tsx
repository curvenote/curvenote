import { CircleUser } from 'lucide-react';
import { cn, ui } from '@curvenote/scms-core';

/** openRxiv brand red for staff-only queues. */
const OPENRXIV_RED = '#D85256';

/** Human-readable label for a queue name slug. */
export function formatCategoryTagLabel(tag: string): string {
  return tag
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Person-in-circle icon: green for public queues, openRxiv red for staff-only. */
export function QueueAccessIndicator({ staff, className }: { staff: boolean; className?: string }) {
  return (
    <CircleUser
      className={cn('size-3 shrink-0', !staff && 'text-green-600 dark:text-green-500', className)}
      style={staff ? { color: OPENRXIV_RED } : undefined}
      aria-label={staff ? 'Staff queue' : 'Public queue'}
    />
  );
}

interface CategoryTagBadgeProps {
  tag: string;
  staff?: boolean;
  /** When true, uses filled primary styling (e.g. active filter chip). */
  selected?: boolean;
  className?: string;
}

/**
 * Queue badge for submission listing rows.
 */
export function CategoryTagBadge({
  tag,
  staff = false,
  selected = false,
  className,
}: CategoryTagBadgeProps) {
  return (
    <ui.Badge
      variant={selected ? 'default' : 'outline-muted'}
      size="sm"
      className={cn(
        'gap-1 px-2.5 py-0.5 text-xs font-normal tracking-normal text-muted-foreground',
        className,
      )}
      title={staff ? 'Queue: staff only' : `Queue: ${tag}`}
    >
      {formatCategoryTagLabel(tag)}
      <QueueAccessIndicator staff={staff} />
    </ui.Badge>
  );
}
