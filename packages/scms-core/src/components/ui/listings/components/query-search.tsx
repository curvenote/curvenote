import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { Search, X } from 'lucide-react';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Generic Query Search Component
export interface QuerySearchProps<TQuery> {
  searchTerm?: string;
  resultCount: number;
  placeholder?: string;
  resultLabel?: string;
  debounceMs?: number;
  parseQuery: (qValue: string) => TQuery;
  buildQuery: (query: TQuery) => string;
  updateQuerySearch: (query: TQuery, searchTerm: string | undefined) => TQuery;
  className?: string;
}

export function QuerySearch<TQuery>({
  searchTerm,
  resultCount,
  placeholder = 'Search...',
  resultLabel = 'item',
  debounceMs = 300,
  parseQuery,
  buildQuery,
  updateQuerySearch,
  className = '',
}: QuerySearchProps<TQuery>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchTerm || '');
  const debouncedSearch = useDebounce(searchInput, debounceMs);

  const getCurrentQuery = (): TQuery => {
    const qValue = searchParams.get('q') || '';
    if (qValue) {
      return parseQuery(qValue);
    }
    return {} as TQuery;
  };

  const updateQuery = (newQuery: TQuery) => {
    const newSearchParams = new URLSearchParams(searchParams);
    const queryString = buildQuery(newQuery);

    if (queryString) {
      newSearchParams.set('q', queryString);
    } else {
      newSearchParams.delete('q');
    }

    setSearchParams(newSearchParams);
  };

  // Update URL when debounced search changes
  useEffect(() => {
    // Normalize values: treat undefined and empty string as the same
    const normalizedSearchTerm = searchTerm?.trim() || undefined;
    const normalizedDebouncedSearch = debouncedSearch.trim() || undefined;

    if (normalizedDebouncedSearch !== normalizedSearchTerm) {
      const currentQuery = getCurrentQuery();
      const newQuery = updateQuerySearch(currentQuery, normalizedDebouncedSearch);
      updateQuery(newQuery);
    }
  }, [debouncedSearch, searchTerm]);

  const clearSearch = useCallback(() => {
    setSearchInput('');
    const currentQuery = getCurrentQuery();
    const newQuery = updateQuerySearch(currentQuery, undefined);
    updateQuery(newQuery);
  }, []);

  return (
    <div className={`mb-6 ${className}`}>
      <div className="relative">
        <div className="flex absolute inset-y-0 left-0 items-center pl-3 pointer-events-none">
          <Search className="w-5 h-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder={placeholder}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="block py-2 pr-10 pl-10 w-full rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        />
        {searchInput && (
          <button
            onClick={clearSearch}
            className="flex absolute inset-y-0 right-0 items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      {searchTerm && (
        <div className="flex justify-between items-center mt-2">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing results for "{searchTerm}" • {resultCount} {resultLabel}
            {resultCount !== 1 ? 's' : ''} found
          </div>
        </div>
      )}
    </div>
  );
}
