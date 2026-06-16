import { useSearchParams } from 'react-router';
import { cn } from '@curvenote/scms-core';
import { clearListingFilters, hasActiveListingFilters } from './listingParams.js';
import type { ToolbarCollectionOption, ToolbarKindOption } from './route.js';
import { SubmissionsSearchInput } from './SubmissionsSearchInput.js';
import { SubmissionsSearchHelp } from './SubmissionsSearchHelp.js';
import { SubmissionsSortButton } from './SubmissionsSortButton.js';
import { SubmissionsKindFilter } from './SubmissionsKindFilter.js';
import { SubmissionsCollectionFilter } from './SubmissionsCollectionFilter.js';
import { SubmissionsDateFilter } from './SubmissionsDateFilter.js';
import { SubmissionsStatusFilter } from './SubmissionsStatusFilter.js';

interface SubmissionsListingToolbarProps {
  /** Kinds the user can filter by. Empty -> kind chip hidden (single-kind site). */
  availableKinds: ToolbarKindOption[];
  /** Collections the user can filter by. Empty -> collection chip hidden. */
  availableCollections: ToolbarCollectionOption[];
  /** Loader-provided total after applying current filters/search. */
  totalResults: number;
  className?: string;
}

/**
 * Layout frame for the submissions index listing controls.
 *
 *   ┌─ Search input ──────────────────────────────────────── (i) ┐
 *   ├────────────────────────────────────────────────────────────┤
 *   │  [Kind ▾] [Collection ▾] [Status ▾] [Published ▾]   Sort ▾ │
 *   └────────────────────────────────────────────────────────────┘
 *   "12 results matching 'photo'  ·  Clear filters"
 *
 * Each control reads/writes its own URL param via `listingParams.ts` helpers;
 * the toolbar itself only composes them and renders the result summary.
 *
 * The (i) help icon next to the search field documents the ILIKE-backed
 * matching behaviour (including the `%` and `_` wildcards). Search commits on
 * Enter or blur — see `SubmissionsSearchInput`. Sort lives at the right end of the filter row so it sits beside the chips it conceptually
 * belongs to, rather than competing with the search input for top-row space.
 */
export function SubmissionsListingToolbar({
  availableKinds,
  availableCollections,
  totalResults,
  className,
}: SubmissionsListingToolbarProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const hasActiveFilters = hasActiveListingFilters(searchParams);
  const searchTerm = searchParams.get('q') ?? '';

  const handleClearAll = () => {
    setSearchParams((prev) => clearListingFilters(prev), {
      replace: false,
      preventScrollReset: true,
    });
  };

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <SubmissionsSearchInput className="flex-1" />
        <SubmissionsSearchHelp />
      </div>

      <div className="flex min-h-11 flex-wrap items-center gap-2 px-3 py-2">
        <SubmissionsKindFilter kinds={availableKinds} />
        <SubmissionsCollectionFilter collections={availableCollections} />
        <SubmissionsStatusFilter />
        <SubmissionsDateFilter />
        <SubmissionsSortButton className="ml-auto" />
      </div>

      {hasActiveFilters ? (
        <div className="flex items-center justify-between gap-2 border-t border-gray-200 px-3 py-1.5 text-xs text-muted-foreground dark:border-gray-700">
          <p>{formatResultsSummary(totalResults, searchTerm)}</p>
          <button
            type="button"
            onClick={handleClearAll}
            className="font-medium text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : null}
    </div>
  );
}

function formatResultsSummary(total: number, searchTerm: string): string {
  const noun = total === 1 ? 'result' : 'results';
  if (searchTerm) {
    return `${total.toLocaleString()} ${noun} matching “${searchTerm}”`;
  }
  return `${total.toLocaleString()} ${noun} matching current filters`;
}
