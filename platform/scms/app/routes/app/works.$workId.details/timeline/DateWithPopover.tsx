import { cn, formatToNow, formatDate, ui } from '@curvenote/scms-core';

type DateWithPopoverProps = {
  /** ISO or parseable date string — drives the relative “X ago” text (may differ from created/modified, e.g. published date). */
  date: string;
  /** When both are set, tooltip lists Created and Modified on separate rows. */
  dateCreated?: string;
  dateModified?: string;
  /** Optional class for the trigger (e.g. text-xs text-muted-foreground ml-2) */
  className?: string;
};

function formatFull(d: string) {
  return formatDate(d, 'MMM d, yyyy h:mm:ss a');
}

/**
 * Shows relative date (e.g. "3 days ago"); tooltip shows full timestamps on hover.
 */
export function DateWithPopover({
  date,
  dateCreated,
  dateModified,
  className,
}: DateWithPopoverProps) {
  const relative = formatToNow(date, { addSuffix: true });

  if (!relative) return null;

  const hasCreatedModified =
    dateCreated != null && dateCreated !== '' && dateModified != null && dateModified !== '';

  const tooltipBody = hasCreatedModified ? (
    <div className="flex flex-col gap-1 tabular-nums text-left text-popover-foreground">
      <div>
        <span className="text-muted-foreground">Created</span>{' '}
        <span>{formatFull(dateCreated)}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Modified</span>{' '}
        <span>{formatFull(dateModified)}</span>
      </div>
    </div>
  ) : (
    formatFull(date)
  );

  return (
    <ui.TooltipProvider delayDuration={1000}>
      <ui.Tooltip delayDuration={1000}>
        <ui.TooltipTrigger asChild>
          <span className={cn(className, 'cursor-default')}>{relative}</span>
        </ui.TooltipTrigger>
        <ui.TooltipContent side="top" className="text-sm max-w-[min(100vw-2rem,22rem)]">
          {tooltipBody}
        </ui.TooltipContent>
      </ui.Tooltip>
    </ui.TooltipProvider>
  );
}
