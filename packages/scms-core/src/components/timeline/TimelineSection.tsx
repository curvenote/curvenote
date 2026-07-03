import type { ReactNode } from 'react';
import { GitBranch } from 'lucide-react';
import { cn } from '../../utils/cn.js';

type TimelineSectionProps = {
  /** Section header label (e.g. date or "Version 1") */
  label: ReactNode;
  /** Optional icon; defaults to GitBranch */
  icon?: ReactNode;
  /** Optional right-aligned content in the header row (e.g. version kebab menu) */
  trailing?: ReactNode;
  /** When true, label and content align on the same row (same top level), e.g. for nested timeline under a card */
  nested?: boolean;
  /** When true, label row sits above full-width content (e.g. checks page version history). */
  stacked?: boolean;
  /** Timeline item nodes (plain or expandable items) */
  children: ReactNode;
  /** If true, no items block is rendered (header only) */
  empty?: boolean;
  className?: string;
};

/**
 * One timeline section (e.g. one work version): header with icon + label, then optional card of items.
 * When nested, the label row and content card share the same top (side-by-side).
 * When stacked, the label row is above a full-width content card.
 */
export function TimelineSection({
  label,
  icon,
  trailing,
  nested = false,
  stacked = false,
  children,
  empty = false,
  className,
}: TimelineSectionProps) {
  const hasChildren = !empty && Boolean(children);
  const header = (
    <div
      className={cn(
        'flex relative gap-1.5 items-center group',
        hasChildren && !nested && !stacked && 'mb-2',
        nested && 'shrink-0',
      )}
    >
      <div className="relative z-10 -ml-[8px] p-1 shrink-0">
        {icon ?? <GitBranch className="w-5 h-5 bg-background text-foreground/60" />}
      </div>
      <div className={cn('flex flex-col min-w-0', !nested && 'flex-1')}>
        <span className="text-sm text-foreground">{label}</span>
      </div>
      {trailing != null && <div className="ml-auto shrink-0">{trailing}</div>}
    </div>
  );

  const content = hasChildren ? (
    <div
      className={cn(
        'overflow-hidden rounded-lg border divide-y shadow-sm bg-card text-card-foreground divide-border border-border',
        stacked ? 'min-w-0' : nested ? 'flex-1 min-w-0' : 'ml-5',
      )}
    >
      {children}
    </div>
  ) : null;

  if (stacked && hasChildren) {
    return (
      <div className={cn('grid grid-cols-[auto_1fr] gap-x-1.5 gap-y-0 items-center', className)}>
        <div className="relative z-10 -ml-[8px] p-1 shrink-0 self-start">
          {icon ?? <GitBranch className="w-5 h-5 bg-background text-foreground/60" />}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm text-foreground">{label}</span>
        </div>
        <div
          className={cn(
            'col-start-2 min-w-0 overflow-hidden rounded-lg border divide-y shadow-sm bg-card text-card-foreground divide-border border-border',
          )}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('', nested && hasChildren && 'flex items-center gap-3', className)}>
      {header}
      {content}
    </div>
  );
}
