import type { ReactNode } from 'react';
import { cn } from '@curvenote/scms-core';

type TimelineProps = {
  /** Optional title (e.g. "Timeline") */
  title?: ReactNode;
  /** Optional slot for header actions (e.g. filter dropdown) */
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Root timeline component: vertical stem (line) and list of sections.
 * Completely generic; no awareness of work versions or events.
 */
export function Timeline({ title, headerAction, children, className }: TimelineProps) {
  return (
    <div className={cn('', className)}>
      {(title != null || headerAction != null) && (
        <div className="flex justify-between items-center mb-3">
          {title != null && (
            <span className="text-sm font-normal text-muted-foreground">
              {title}
            </span>
          )}
          {headerAction != null && <div>{headerAction}</div>}
        </div>
      )}
      <div className="relative">
        <div className="absolute left-0 top-2 bottom-2 w-[2px] bg-border" aria-hidden />
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}
