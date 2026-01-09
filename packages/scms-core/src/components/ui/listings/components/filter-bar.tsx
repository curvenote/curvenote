import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CheckSquare, Square } from 'lucide-react';
import { Button } from '../../button.js';
import type { FilterDefinition } from './types.js';

export interface FilterBarProps<TQuery> {
  filters: FilterDefinition[];
  parseQuery: (qValue: string) => TQuery;
  buildQuery: (query: TQuery) => string;
  isFilterActive: (query: TQuery, key: string, value: any) => boolean;
  updateQuery: (query: TQuery, key: string, value: any) => TQuery;
  clearFilters: (query: TQuery) => TQuery;
  hasActiveFilters: (query: TQuery) => boolean;
  totalCount?: number;
  className?: string;
}

export function FilterBar<TQuery>({
  filters,
  parseQuery,
  buildQuery,
  isFilterActive,
  updateQuery,
  clearFilters,
  hasActiveFilters,
  totalCount,
  className = '',
}: FilterBarProps<TQuery>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentQuery, setCurrentQuery] = useState<TQuery>({} as TQuery);

  // Update current query when search params change
  useEffect(() => {
    const qValue = searchParams.get('q') || '';
    if (qValue) {
      try {
        const parsed = parseQuery(qValue);
        setCurrentQuery(parsed);
      } catch (error) {
        console.error('Error parsing query:', error);
        setCurrentQuery({} as TQuery);
      }
    } else {
      setCurrentQuery({} as TQuery);
    }
  }, [searchParams]);

  const handleUpdateQuery = (key: string, value: any) => {
    const newQuery = updateQuery(currentQuery, key, value);

    const newSearchParams = new URLSearchParams(searchParams);
    const queryString = buildQuery(newQuery);

    if (queryString) {
      newSearchParams.set('q', queryString);
    } else {
      newSearchParams.delete('q');
    }

    setSearchParams(newSearchParams);
  };

  const handleClearAllFilters = () => {
    const newQuery = clearFilters(currentQuery);

    const newSearchParams = new URLSearchParams(searchParams);
    const queryString = buildQuery(newQuery);

    if (queryString) {
      newSearchParams.set('q', queryString);
    } else {
      newSearchParams.delete('q');
    }

    setSearchParams(newSearchParams);
  };

  const hasFilters = hasActiveFilters(currentQuery);

  return (
    <div
      className={`flex flex-col gap-4 p-4 bg-gray-50 border-b border-gray-200 dark:bg-gray-900 dark:border-gray-700 ${className}`}
    >
      <div className="flex flex-wrap gap-4 items-center">
        {/* All Filter */}
        <Button
          variant={!hasFilters ? 'default' : 'ghost'}
          size="sm"
          onClick={handleClearAllFilters}
          className="flex items-center px-3 space-x-2 h-8"
        >
          {!hasFilters ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          <span>
            All
            {totalCount !== undefined && (
              <span className="ml-1 text-xs opacity-75">({totalCount})</span>
            )}
          </span>
        </Button>

        {/* Filter Buttons */}
        {filters.map((filter) => (
          <Button
            key={`${filter.key}-${filter.value}`}
            variant={isFilterActive(currentQuery, filter.key, filter.value) ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleUpdateQuery(filter.key, filter.value)}
            className="flex items-center px-3 space-x-2 h-8"
          >
            {isFilterActive(currentQuery, filter.key, filter.value) ? (
              <CheckSquare className="w-4 h-4" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            <span>
              {filter.label}
              {filter.count !== undefined && (
                <span className="ml-1 text-xs opacity-75">({filter.count})</span>
              )}
            </span>
          </Button>
        ))}
      </div>

      {/* Right side - placeholder for future filters - only show if there's content */}
      {/* Future filters can go here */}
    </div>
  );
}
