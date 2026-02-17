import type { ReactNode } from 'react';
import { cn } from '@curvenote/scms-core';

type TimelineProps = {
  /** Optional title (e.g. "Timeline") */
  title?: ReactNode;
  /** Optional slot for header actions (e.g. filter dropdown) */
  headerAction?: ReactNode;
  /** When true, the vertical line extends to the top of the timeline (e.g. to touch the card above). */
  nested?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Root timeline component: vertical stem (line) and list of sections.
 * Completely generic; no awareness of work versions or events.
 */
export function Timeline({
  title,
  headerAction,
  nested = false,
  children,
  className,
}: TimelineProps) {
  const lineTop = nested ? 'top-0' : 'top-2';
  return (
    <div className={cn('', className)}>
      {(title != null || headerAction != null) && (
        <div className="flex justify-between items-center mb-3">
          {title != null && (
            <span className="text-sm font-normal text-muted-foreground">{title}</span>
          )}
          {headerAction != null && <div>{headerAction}</div>}
        </div>
      )}
      <div className="relative">
        <div className={cn('absolute left-0 bottom-2 w-[2px] bg-border', lineTop)} aria-hidden />
        <div className={cn('space-y-6', nested && 'pt-5')}>{children}</div>
      </div>
    </div>
  );
}
