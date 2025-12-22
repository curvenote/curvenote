import React, { useState, useEffect, useMemo } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useSearchParams } from 'react-router';
import type { FilterDefinition } from './types.js';
import { buildDefaultFilters } from './filter-utils.js';
import { getInitialStateFromURL, updateURLWithState } from './url-state-utils.js';

// Global state store for persistent filter state across navigation
const globalFilterState = new Map<string, { filters: Record<string, any>; search: string }>();

// Error boundary for client-side filtering
class ClientListErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('ClientFilterableList error caught:', error.message);
  }

  render() {
    if (this.state.hasError) {
      setTimeout(() => this.setState({ hasError: false }), 0);
      return null;
    }

    return this.props.children;
  }
}

export interface ClientFilterableListProps<T> {
  // Data loading - support both direct arrays and promises
  items: T[] | Promise<T[]> | undefined;

  // Components
  searchComponent?: (
    searchTerm: string,
    setSearchTerm: (searchTerm: string) => void,
  ) => React.ReactNode;
  filterBar?: (
    items: T[],
    activeFilters: Record<string, any>,
    setActiveFilters: (filters: Record<string, any>) => void,
    filters: FilterDefinition[],
  ) => React.ReactNode;

  // filtering
  filterItems?: (items: T[], searchTerm: string, activeFilters: Record<string, any>) => T[];

  // Sorting
  sortItems?: (a: T, b: T) => number;

  // Rendering - updated to support both global and local indexes
  renderItem: (item: T, globalIndex: number, localIndex?: number) => React.ReactNode;
  getItemKey?: (item: T, globalIndex: number, localIndex?: number) => string | number;

  // Optional Grouping
  groupBy?: keyof T | ((item: T) => string);
  renderGroup?: (
    groupKey: string,
    groupItems: T[],
    renderItem: (item: T, globalIndex: number, localIndex: number) => React.ReactNode,
  ) => React.ReactNode;
  sortGroups?: (a: [string, T[]], b: [string, T[]]) => number;

  // States
  filters: FilterDefinition[]; // Filter definitions for auto-building defaults and filter behavior
  persist?: boolean; // Optional: keep URL params in sync and persist filter state in memory across navigation (default: false)
  error?: string;
  emptyMessage?: string;
  className?: string;

  // Loading state
  loadingComponent?: React.ReactNode;
}

export function ClientFilterableList<T>({
  items,
  searchComponent,
  filterBar,
  filterItems,
  sortItems,
  renderItem,
  getItemKey,
  groupBy,
  renderGroup,
  sortGroups,
  error,
  emptyMessage = 'No items found.',
  className = '',
  loadingComponent,
  filters,
  persist = false,
}: ClientFilterableListProps<T>) {
  // Get search params from Remix (works on both server and client)
  const [searchParams] = useSearchParams();

  // Build default filters automatically from filter definitions
  const effectiveDefaultFilters = useMemo(() => {
    return buildDefaultFilters(filters);
  }, [filters]);

  // Get initial state (filters and search) - from memory, URL, or defaults
  const initialState = useMemo(() => {
    // Create a unique key for this component instance (based on route path)
    const stateKey = typeof window !== 'undefined' ? window.location.pathname : 'default';

    // Priority: 1. Memory state, 2. URL state, 3. Defaults
    if (persist && globalFilterState.has(stateKey)) {
      return globalFilterState.get(stateKey)!;
    }

    if (persist) {
      return getInitialStateFromURL(effectiveDefaultFilters, '', searchParams);
    }

    return { filters: effectiveDefaultFilters, search: '' };
  }, [persist, effectiveDefaultFilters, searchParams]);

  const [searchTerm, setSearchTerm] = useState(initialState.search);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>(initialState.filters);

  // Sync URL when activeFilters or searchTerm change (if persist=true)
  useEffect(() => {
    if (persist) {
      updateURLWithState(activeFilters, searchTerm);
    }
  }, [activeFilters, searchTerm, persist]);

  // Save state to memory when persist is enabled
  useEffect(() => {
    if (persist && typeof window !== 'undefined') {
      const stateKey = window.location.pathname;
      globalFilterState.set(stateKey, { filters: activeFilters, search: searchTerm });
    }
  }, [activeFilters, searchTerm, persist]);

  const [resolvedItems, setResolvedItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Handle both direct arrays and promises
  useEffect(() => {
    if (Array.isArray(items)) {
      setResolvedItems(items);
      setIsLoading(false);
      setResolveError(null);
    } else if (items instanceof Promise) {
      setIsLoading(true);
      setResolveError(null);
      items
        .then((data) => {
          setResolvedItems(data);
          console.log('resolved data', data);
          setIsLoading(false);
        })
        .catch((promiseError) => {
          console.error('CATCH ERROR: Failed to load items:', promiseError);
          setResolveError(promiseError.message || 'Failed to load items');
          setIsLoading(false);
        });
    }
  }, [items]);

  const filteredItems = useMemo(() => {
    let filtered = resolvedItems;

    // Apply filtering
    if (filterItems) {
      filtered = filterItems(filtered, searchTerm, activeFilters);
    }

    // Apply sorting
    if (sortItems) {
      filtered = [...filtered].sort(sortItems);
    }

    return filtered;
  }, [resolvedItems, searchTerm, activeFilters, filterItems, sortItems]);

  // Group items if groupBy is provided
  const groupedItems = useMemo(() => {
    if (!groupBy) return null;

    const groups: Record<string, T[]> = {};

    filteredItems.forEach((item) => {
      const groupKey = typeof groupBy === 'function' ? groupBy(item) : String(item[groupBy]);

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    });

    // Sort groups by key (same logic as progressive-load-grouped.tsx)
    const groupEntries = Object.entries(groups);

    if (sortGroups) {
      return groupEntries.sort(sortGroups);
    }

    // Default sort: descending order
    return groupEntries.sort(([a], [b]) => {
      // Try to sort as numbers first, then as strings
      const aNum = Number(a);
      const bNum = Number(b);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return bNum - aNum; // Descending order
      }
      return b.localeCompare(a); // Descending order for strings
    });
  }, [filteredItems, groupBy, sortGroups]);

  // Render grouped or flat items based on groupBy prop
  const renderedContent = useMemo(() => {
    // If groupBy and renderGroup are provided, render grouped content
    if (groupBy && renderGroup && groupedItems) {
      return (
        <div className="space-y-0">
          {groupedItems.map(([groupKey, groupItems]) => {
            return <div key={groupKey}>{renderGroup(groupKey, groupItems, renderItem)}</div>;
          })}
        </div>
      );
    }

    // Otherwise, render flat list (backward compatible)
    return filteredItems.map((item, index) => (
      <div
        key={getItemKey ? getItemKey(item, index) : `item-${index}`}
        className="flex flex-col gap-2 p-6 border-b border-gray-200 md:items-center md:flex-row md:gap-6 dark:border-gray-700 last:border-b-0"
      >
        {renderItem(item, index)}
      </div>
    ));
  }, [filteredItems, groupedItems, groupBy, renderGroup, renderItem, getItemKey]);

  // Show error state
  if (error || resolveError) {
    return (
      <div className={`container mx-auto max-w-6xl ${className}`}>
        <div className="p-4 mb-6 bg-red-50 rounded-lg border border-red-200 dark:bg-red-900/20">
          <div className="text-red-700 dark:text-red-400">
            <h3 className="mb-2 font-semibold">Error</h3>
            <p>{error || resolveError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ClientListErrorBoundary>
      <div className={`container mx-auto max-w-6xl ${className}`}>
        {/* Search Component */}
        {searchComponent && searchComponent(searchTerm, setSearchTerm)}

        {/* List Container */}
        <div className="overflow-hidden bg-white rounded-sm border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
          {/* Filter Bar */}
          {filterBar && filterBar(resolvedItems, activeFilters, setActiveFilters, filters)}

          {/* Items */}
          {!isLoading && renderedContent}
          {isLoading && (
            <div className={`container mx-auto max-w-6xl ${className}`}>
              {loadingComponent || (
                <div className="flex justify-center py-8">
                  <div className="flex gap-2 items-center text-sm text-gray-500">
                    <LoaderCircle className="w-4 h-4 animate-spin" />
                    Loading items...
                  </div>
                </div>
              )}
            </div>
          )}
          {!isLoading && filteredItems.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
            </div>
          )}
        </div>
      </div>
    </ClientListErrorBoundary>
  );
}
