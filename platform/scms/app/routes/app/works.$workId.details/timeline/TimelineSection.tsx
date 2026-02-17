import type { ReactNode } from 'react';
import { cn } from '@curvenote/scms-core';
import { GitBranch } from 'lucide-react';

type TimelineSectionProps = {
  /** Section header label (e.g. date or "Version 1") */
  label: ReactNode;
  /** Optional icon; defaults to GitBranch */
  icon?: ReactNode;
  /** Optional right-aligned content in the header row (e.g. version kebab menu) */
  trailing?: ReactNode;
  /** When true, label and content align on the same row (same top level), e.g. for nested timeline under a card */
  nested?: boolean;
  /** Timeline item nodes (plain or expandable items) */
  children: ReactNode;
  /** If true, no items block is rendered (header only) */
  empty?: boolean;
  className?: string;
};

/**
 * One timeline section (e.g. one work version): header with icon + label, then optional card of items.
 * When nested, the label row and content card share the same top (side-by-side).
 */
export function TimelineSection({
  label,
  icon,
  trailing,
  nested = false,
  children,
  empty = false,
  className,
}: TimelineSectionProps) {
  const hasChildren = !empty && Boolean(children);
  return (
    <div className={cn('', nested && hasChildren && 'flex items-center gap-3', className)}>
      <div
        className={cn(
          'flex relative gap-1.5 items-center group',
          hasChildren && !nested && 'mb-2',
          nested && 'shrink-0',
        )}
      >
        <div className="relative z-10 -ml-[7px] p-1 shrink-0">
          {icon ?? <GitBranch className="w-5 h-5 text-foreground" />}
        </div>
        <div className={cn('flex flex-col min-w-0', !nested && 'flex-1')}>
          <span className="text-sm text-foreground">{label}</span>
        </div>
        {trailing != null && <div className="ml-auto shrink-0">{trailing}</div>}
      </div>
      {hasChildren && (
        <div
          className={cn(
            'overflow-hidden rounded-lg border divide-y shadow-sm divide-border/50 border-border/40',
            nested ? 'flex-1 min-w-0' : 'ml-5',
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
