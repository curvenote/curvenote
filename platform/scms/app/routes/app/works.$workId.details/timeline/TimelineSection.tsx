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
  /** Timeline item nodes (plain or expandable items) */
  children: ReactNode;
  /** If true, no items block is rendered (header only) */
  empty?: boolean;
  className?: string;
};

/**
 * One timeline section (e.g. one work version): header with icon + label, then optional card of items.
 */
export function TimelineSection({
  label,
  icon,
  trailing,
  children,
  empty = false,
  className,
}: TimelineSectionProps) {
  const hasChildren = !empty && Boolean(children);
  return (
    <div className={cn('', className)}>
      <div className={cn('flex relative gap-2 items-center group', hasChildren ? 'mb-2' : 'mb-0')}>
        <div className="relative z-10 -ml-[9px] p-1.5 shrink-0">
          {icon ?? <GitBranch className="w-5 h-5 text-foreground" />}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-sm text-foreground">{label}</span>
        </div>
        {trailing != null && <div className="ml-auto shrink-0">{trailing}</div>}
      </div>
      {hasChildren && (
        <div className="overflow-hidden ml-5 rounded-lg border divide-y shadow-sm divide-border/50 border-border/40">
          {children}
        </div>
      )}
    </div>
  );
}
