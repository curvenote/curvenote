/**
 * Progressive Load with Grouping Pattern
 *
 * This pattern is designed for large datasets that need to be loaded progressively
 * with logical grouping (e.g., by year, category, etc.). It supports both pagination
 * and streaming approaches using React Router's defer() and Await components.
 *
 * When to Use This Component:
 * - Large datasets that would be slow to load all at once
 * - Data that can be logically grouped (e.g., publications by year)
 * - When you want to show initial content while loading more data
 * - When you need progressive loading with "Load More" functionality
 * - When you want to stream data as it becomes available
 *
 * What This Component Does:
 * - Loads data progressively in chunks/pages
 * - Groups items by a specified key (e.g., year, category)
 * - Supports both pagination and streaming approaches
 * - Provides "Load More" functionality for pagination
 * - Handles loading states and error boundaries
 * - Maintains grouping integrity as new data loads
 * - Supports infinite scroll (future enhancement)
 *
 * Backend Requirements:
 *
 * 1. Loader Function (Pagination Approach):
 * ```typescript
 * export async function loader(args: LoaderFunctionArgs) {
 *   const url = new URL(args.request.url);
 *   const page = parseInt(url.searchParams.get('page') || '1');
 *   const pageSize = 20;
 *
 *   const items = await dbGetItems({
 *     skip: (page - 1) * pageSize,
 *     take: pageSize,
 *     orderBy: { date: 'desc' } // Important for grouping
 *   });
 *
 *   return json({
 *     items,
 *     hasMore: items.length === pageSize,
 *     currentPage: page
 *   });
 * }
 * ```
 *
 * 2. Loader Function (Streaming Approach):
 * ```typescript
 * export async function loader(args: LoaderFunctionArgs) {
 *   const itemsPromise = dbGetAllItems(); // Large dataset
 *
 *   return defer({
 *     items: itemsPromise,
 *     metadata: { totalCount: await getTotalCount() }
 *   });
 * }
 * ```
 *
 * 3. Database Query Requirements:
 * - Must support pagination (skip/take) for pagination approach
 * - Must be ordered by grouping field for consistent grouping
 * - Should be optimized for the grouping field (indexes)
 * - For streaming, should support streaming responses
 *
 * Core Components:
 * - ProgressiveList: Main container component
 * - GroupedItems: Handles grouping logic and rendering
 * - LoadMoreButton: For pagination approach
 * - StreamingProgress: For streaming approach
 *
 * Usage Example:
 * ```typescript
 * // In your route component
 * export default function PublicationsList() {
 *   const { items } = useLoaderData<LoaderData>();
 *
 *   return (
 *     <ProgressiveList
 *       items={items}
 *       groupBy="year"
 *       renderGroup={(groupKey, groupItems) => (
 *         <div key={groupKey}>
 *           <h2>{groupKey}</h2>
 *           {groupItems.map(item => (
 *             <PublicationItem key={item.id} publication={item} />
 *           ))}
 *         </div>
 *       )}
 *       loadMoreUrl="/api/publications?page="
 *       hasMore={true}
 *     />
 *   );
 * }
 * ```
 *
 * Common Pitfalls and Considerations:
 * - Ensure data is ordered by grouping field for consistent grouping
 * - Handle loading states gracefully (skeleton loaders)
 * - Consider memory usage with large datasets
 * - Implement proper error boundaries for streaming
 * - Test with various network conditions
 * - Consider caching strategies for frequently accessed data
 * - Monitor performance with large datasets
 */

import React, { useState, useMemo, Suspense } from 'react';
import { Await } from 'react-router';
import { Button } from '../button.js';
import { Loader2 } from 'lucide-react';

// Types
export interface ProgressiveListProps<T> {
  items: T[] | Promise<T[]>;
  groupBy: keyof T | ((item: T) => string);
  renderGroup: (groupKey: string, groupItems: T[]) => React.ReactNode;
  renderItem?: (item: T, index: number) => React.ReactNode;
  loadMoreUrl?: string;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  className?: string;
}

export interface GroupedItemsProps<T> {
  items: T[];
  groupBy: keyof T | ((item: T) => string);
  renderGroup: (groupKey: string, groupItems: T[]) => React.ReactNode;
  renderItem?: (item: T, index: number) => React.ReactNode;
  emptyComponent?: React.ReactNode;
}

// Main Progressive List Component
export function ProgressiveList<T>({
  items,
  groupBy,
  renderGroup,
  renderItem,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  loadMoreUrl,
  hasMore = false,
  onLoadMore,
  loadingComponent,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  errorComponent,
  emptyComponent,
  className = '',
}: ProgressiveListProps<T>) {
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const handleLoadMore = async () => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      if (onLoadMore) {
        await onLoadMore();
      }
    } finally {
      setIsLoadingMore(false);
    }
  };

  const defaultLoadingComponent = (
    <div className="flex justify-center py-8">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading more items...
      </div>
    </div>
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const defaultErrorComponent = (
    <div className="flex justify-center py-8">
      <div className="text-sm text-red-500">Error loading items. Please try again.</div>
    </div>
  );

  const defaultEmptyComponent = (
    <div className="flex justify-center py-8">
      <div className="text-sm text-gray-500">No items found.</div>
    </div>
  );

  // If items is a Promise (streaming approach)
  if (items instanceof Promise) {
    return (
      <div className={className}>
        <Suspense fallback={loadingComponent || defaultLoadingComponent}>
          <Await resolve={items}>
            {(resolvedItems: T[]) => (
              <>
                <GroupedItems
                  items={resolvedItems}
                  groupBy={groupBy}
                  renderGroup={renderGroup}
                  renderItem={renderItem}
                  emptyComponent={emptyComponent || defaultEmptyComponent}
                />
                {hasMore && (
                  <div className="flex justify-center mt-6">
                    <Button onClick={handleLoadMore} disabled={isLoadingMore} variant="outline">
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        'Load More'
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </Await>
        </Suspense>
      </div>
    );
  }

  // If items is an array (pagination approach)
  return (
    <div className={className}>
      <GroupedItems
        items={items}
        groupBy={groupBy}
        renderGroup={renderGroup}
        renderItem={renderItem}
        emptyComponent={emptyComponent || defaultEmptyComponent}
      />
      {hasMore && (
        <div className="flex justify-center mt-6">
          <Button onClick={handleLoadMore} disabled={isLoadingMore} variant="outline">
            {isLoadingMore ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// Grouped Items Component
export function GroupedItems<T>({
  items,
  groupBy,
  renderGroup,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  renderItem,
  emptyComponent,
}: GroupedItemsProps<T>) {
  const groupedItems = useMemo(() => {
    const groups: Record<string, T[]> = {};

    items.forEach((item) => {
      const groupKey = typeof groupBy === 'function' ? groupBy(item) : String(item[groupBy]);

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    });

    // Sort groups by key (assuming keys are sortable)
    return Object.entries(groups).sort(([a], [b]) => {
      // Try to sort as numbers first, then as strings
      const aNum = Number(a);
      const bNum = Number(b);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return bNum - aNum; // Descending order
      }
      return b.localeCompare(a); // Descending order for strings
    });
  }, [items, groupBy]);

  if (items.length === 0) {
    return <>{emptyComponent}</>;
  }

  return (
    <div className="space-y-8">
      {groupedItems.map(([groupKey, groupItems]) => (
        <div key={groupKey}>{renderGroup(groupKey, groupItems)}</div>
      ))}
    </div>
  );
}

// Error Boundary for Progressive Loading
export class ProgressiveListErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ProgressiveList Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex justify-center py-8">
            <div className="text-sm text-red-500">Something went wrong loading the items.</div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// Convenience wrapper with error boundary
export function ProgressiveListWithErrorBoundary<T>(props: ProgressiveListProps<T>) {
  return (
    <ProgressiveListErrorBoundary>
      <ProgressiveList {...props} />
    </ProgressiveListErrorBoundary>
  );
}
