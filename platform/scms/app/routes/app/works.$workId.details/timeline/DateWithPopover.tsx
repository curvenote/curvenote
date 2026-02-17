import { cn, formatToNow, formatDate, ui } from '@curvenote/scms-core';

type DateWithPopoverProps = {
  /** ISO or parseable date string */
  date: string;
  /** Optional class for the trigger (e.g. text-xs text-muted-foreground ml-2) */
  className?: string;
};

/**
 * Shows relative date (e.g. "3 days ago"); tooltip shows full formatted timestamp on hover.
 */
export function DateWithPopover({ date, className }: DateWithPopoverProps) {
  const relative = formatToNow(date, { addSuffix: true });
  const full = formatDate(date, 'MMM d, yyyy h:mm:ss a');

  if (!relative) return null;

  return (
    <ui.TooltipProvider delayDuration={1000}>
      <ui.Tooltip delayDuration={1000}>
        <ui.TooltipTrigger asChild>
          <span className={cn(className, 'cursor-default')}>{relative}</span>
        </ui.TooltipTrigger>
        <ui.TooltipContent side="top" className="text-sm">
          {full}
        </ui.TooltipContent>
      </ui.Tooltip>
    </ui.TooltipProvider>
  );
}
