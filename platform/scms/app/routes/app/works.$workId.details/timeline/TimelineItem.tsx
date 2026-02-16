import { useState, type ReactNode } from 'react';
import { cn } from '@curvenote/scms-core';
import { ChevronDown } from 'lucide-react';

/** Props for a plain timeline row: icon, message, date. No expand, no pill. */
export type TimelineItemPlainProps = {
  icon: ReactNode;
  /** Main text; can include inline user/entity chips */
  message: ReactNode;
  /** Formatted date string (e.g. "2 days ago") */
  date: ReactNode;
  /** Optional trailing content (e.g. kebab menu) */
  trailing?: ReactNode;
  className?: string;
};

/**
 * Plain timeline item: icon, message, date. Non-interactive.
 */
export function TimelineItemPlain({
  icon,
  message,
  date,
  trailing,
  className,
}: TimelineItemPlainProps) {
  return (
    <div
      className={cn(
        'flex gap-3 items-center px-4 py-3 bg-white transition-colors hover:bg-muted/40',
        className,
      )}
    >
      <div className="shrink-0 text-foreground [&>svg]:w-4 [&>svg]:h-4">{icon}</div>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-foreground">{message}</span>
        <span className="ml-2 text-xs text-muted-foreground">{date}</span>
      </div>
      {trailing != null && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}

/** Pill shown on the right of an expandable item (optional) */
export type TimelineItemPillProps = {
  label: ReactNode;
  onClick?: () => void;
  /** Optional variant for styling (e.g. "success") */
  variant?: 'default' | 'success';
};

/**
 * Small pill/badge for timeline item (e.g. "38 FIGURES PASSED").
 */
export function TimelineItemPill({ label, onClick, variant = 'default' }: TimelineItemPillProps) {
  const isButton = onClick != null;
  const base =
    'shrink-0 inline-flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide rounded-[2px] px-1.5 py-0.5 min-w-[80px]';
  const variantClass =
    variant === 'success'
      ? 'text-teal-700 border border-teal-700 hover:bg-teal-50'
      : 'text-foreground border border-border hover:bg-muted/50';
  const className = cn(base, variantClass, isButton && 'cursor-pointer');

  if (isButton) {
    return (
      <button type="button" onClick={onClick} className={className} title="View details">
        {label}
      </button>
    );
  }
  return <span className={className}>{label}</span>;
}

/** Props for an expandable timeline row: same as plain + optional pill + tray content slot */
export type TimelineItemExpandableProps = {
  icon: ReactNode;
  message: ReactNode;
  date: ReactNode;
  /** Optional pill on the right (before chevron) */
  pill?: ReactNode;
  /** Optional trailing content (e.g. kebab menu) before pill/chevron */
  trailing?: ReactNode;
  /** Content rendered in the expandable tray below the row */
  children?: ReactNode;
  className?: string;
};

/**
 * Expandable timeline item: row with optional pill and chevron; when expanded, renders children below.
 * Caller supplies tray content; we do not implement controls inside the tray.
 */
export function TimelineItemExpandable({
  icon,
  message,
  date,
  pill,
  trailing,
  children,
  className,
}: TimelineItemExpandableProps) {
  const [expanded, setExpanded] = useState(false);
  const hasTray = children != null;

  return (
    <div>
      <div
        onClick={hasTray ? () => setExpanded((e) => !e) : undefined}
        className={cn(
          'flex items-center gap-3 px-4 py-3 bg-white hover:bg-muted/40 transition-colors',
          hasTray && 'cursor-pointer',
          className,
        )}
      >
        <div className="shrink-0 text-foreground [&>svg]:w-4 [&>svg]:h-4">{icon}</div>
        <div className="flex-1 min-w-0">
          <span className="text-sm text-foreground">{message}</span>
          <span className="ml-2 text-xs text-muted-foreground">{date}</span>
        </div>
        {trailing != null && (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {trailing}
          </div>
        )}
        {pill != null && <div className="shrink-0">{pill}</div>}
        {hasTray && (
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform shrink-0',
              expanded && 'rotate-180',
            )}
            aria-hidden
          />
        )}
      </div>
      {hasTray && expanded && (
        <div className="px-4 py-4 bg-white border-t border-border/50">{children}</div>
      )}
    </div>
  );
}
