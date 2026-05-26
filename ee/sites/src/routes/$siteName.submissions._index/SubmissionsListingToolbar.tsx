import { Search } from 'lucide-react';
import { cn, ui } from '@curvenote/scms-core';

interface SubmissionsListingToolbarProps {
  className?: string;
}

export function SubmissionsListingToolbar({ className }: SubmissionsListingToolbarProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
        className,
      )}
    >
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <ui.InputWithAdornments
          className="border-0 bg-stone-100 shadow-none focus-within:ring-1 dark:bg-stone-900/60"
          leadingAdornment={<Search className="size-4 text-muted-foreground" />}
        >
          <ui.Input
            readOnly
            tabIndex={-1}
            placeholder="Search submissions..."
            aria-label="Search submissions"
            className="h-9 border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </ui.InputWithAdornments>
      </div>

      <div
        className="min-h-11 px-3 py-2"
        aria-hidden
        data-testid="submissions-listing-filters-placeholder"
      />
    </div>
  );
}
