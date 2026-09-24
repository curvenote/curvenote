import { Lock } from 'lucide-react';
import { ui } from '@curvenote/scms-core';

type LockedLabelProps = {
  htmlFor: string;
  children: React.ReactNode;
  /** Why it is locked, in a tooltip on the lock. The lock becomes a button so keyboards reach it. */
  reason?: string;
};

/** A field nobody can edit here: the lock says so next to the label. */
export function LockedLabel({ htmlFor, children, reason }: LockedLabelProps) {
  if (!reason) {
    return (
      <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-sm font-medium">
        {children}
        <Lock className="w-3 h-3 text-muted-foreground" aria-label="Read-only" />
      </label>
    );
  }
  // The button sits outside the label: inside it, a click would also toggle the labelled field.
  return (
    <span className="flex items-center gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {children}
      </label>
      <ui.TooltipProvider>
        <ui.Tooltip>
          <ui.TooltipTrigger asChild>
            <button type="button" aria-label={reason} className="rounded-sm">
              <Lock className="w-3 h-3 text-muted-foreground" aria-hidden />
            </button>
          </ui.TooltipTrigger>
          <ui.TooltipContent sideOffset={5} className="max-w-xs">
            {reason}
          </ui.TooltipContent>
        </ui.Tooltip>
      </ui.TooltipProvider>
    </span>
  );
}
