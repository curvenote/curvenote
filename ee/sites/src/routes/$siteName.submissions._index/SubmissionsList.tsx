import { useSearchParams } from 'react-router';
import { SearchX } from 'lucide-react';
import { ui } from '@curvenote/scms-core';
import type { SubmissionsIndexItem } from './types.js';
import { SubmissionsListItem } from './SubmissionsListItem.js';
import { clearListingFilters, hasActiveListingFilters } from './listingParams.js';

interface SubmissionsListProps {
  siteName: string;
  items: SubmissionsIndexItem[];
  showCollectionChip?: boolean;
  showKindChip?: boolean;
}

export function SubmissionsList({
  siteName,
  items,
  showCollectionChip,
  showKindChip,
}: SubmissionsListProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  if (items.length === 0) {
    const isFilteredEmpty = hasActiveListingFilters(searchParams);
    if (isFilteredEmpty) {
      const searchTerm = searchParams.get('q');
      return (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <SearchX className="size-10 text-muted-foreground/60" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="font-medium text-foreground">
              {searchTerm
                ? `No submissions match “${searchTerm}”.`
                : 'No submissions match the current filters.'}
            </p>
            <p className="text-sm text-muted-foreground">
              Try a different search or remove some filters.
            </p>
          </div>
          <ui.Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setSearchParams((prev) => clearListingFilters(prev), {
                preventScrollReset: true,
              })
            }
          >
            Clear filters
          </ui.Button>
        </div>
      );
    }
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">No submissions found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl">
      <div className="overflow-hidden rounded-sm border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        {items.map((item) => (
          <SubmissionsListItem
            key={item.id}
            siteName={siteName}
            item={item}
            showCollectionChip={showCollectionChip}
            showKindChip={showKindChip}
          />
        ))}
      </div>
    </div>
  );
}
