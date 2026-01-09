/**
 * URL state management utilities for ClientFilterableList persistence
 */

const FILTERS_QUERY_KEY = 'filters';
const SEARCH_QUERY_KEY = 'search';

/**
 * Encode active filters to a URL-safe JSON string
 */
export function encodeFiltersForURL(activeFilters: Record<string, any>): string {
  if (Object.keys(activeFilters).length === 0) {
    return '';
  }
  try {
    return encodeURIComponent(JSON.stringify(activeFilters));
  } catch (error) {
    console.warn('Failed to encode filters for URL:', error);
    return '';
  }
}

/**
 * Decode filters from URL query parameter
 */
export function decodeFiltersFromURL(searchParams: URLSearchParams): Record<string, any> {
  const filtersParam = searchParams.get(FILTERS_QUERY_KEY);
  if (!filtersParam) {
    return {};
  }

  try {
    const decoded = decodeURIComponent(filtersParam);
    return JSON.parse(decoded);
  } catch (error) {
    console.warn('Failed to decode filters from URL:', error);
    return {};
  }
}

/**
 * Get current URL search params (client-side only)
 */
export function getCurrentSearchParams(): URLSearchParams {
  if (typeof window === 'undefined') {
    return new URLSearchParams();
  }
  return new URLSearchParams(window.location.search);
}

/**
 * Encode search term to URL-safe string
 */
export function encodeSearchForURL(searchTerm: string): string {
  const trimmed = searchTerm.trim();
  if (!trimmed) {
    return '';
  }
  try {
    return encodeURIComponent(trimmed);
  } catch (error) {
    console.warn('Failed to encode search for URL:', error);
    return '';
  }
}

/**
 * Decode search term from URL query parameter
 */
export function decodeSearchFromURL(searchParams: URLSearchParams): string {
  const searchParam = searchParams.get(SEARCH_QUERY_KEY);
  if (!searchParam) {
    return '';
  }

  try {
    return decodeURIComponent(searchParam);
  } catch (error) {
    console.warn('Failed to decode search from URL:', error);
    return '';
  }
}

/**
 * Update URL with new filter and search state without causing navigation
 */
export function updateURLWithState(
  activeFilters: Record<string, any>,
  searchTerm: string = '',
  replaceState: boolean = true,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const searchParams = getCurrentSearchParams();

  // Handle filters
  const encodedFilters = encodeFiltersForURL(activeFilters);
  if (encodedFilters) {
    searchParams.set(FILTERS_QUERY_KEY, encodedFilters);
  } else {
    searchParams.delete(FILTERS_QUERY_KEY);
  }

  // Handle search
  const encodedSearch = encodeSearchForURL(searchTerm);
  if (encodedSearch) {
    searchParams.set(SEARCH_QUERY_KEY, encodedSearch);
  } else {
    searchParams.delete(SEARCH_QUERY_KEY);
  }

  const newURL = `${window.location.pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;

  if (replaceState) {
    window.history.replaceState(null, '', newURL);
  } else {
    window.history.pushState(null, '', newURL);
  }
}

/**
 * Update URL with new filter state without causing navigation
 * @deprecated Use updateURLWithState instead for better search + filter support
 */
export function updateURLWithFilters(
  activeFilters: Record<string, any>,
  replaceState: boolean = true,
): void {
  updateURLWithState(activeFilters, '', replaceState);
}

/**
 * Get initial search term from URL
 * @param defaultSearch - Default search term
 * @param searchParams - URLSearchParams to read from (optional, for SSR compatibility)
 */
export function getInitialSearchFromURL(
  defaultSearch: string = '',
  searchParams?: URLSearchParams,
): string {
  // Use provided searchParams (from Remix) or fallback to current URL
  const params = searchParams || getCurrentSearchParams();
  const urlSearch = decodeSearchFromURL(params);

  // Return URL search if present, otherwise default
  return urlSearch || defaultSearch;
}

/**
 * Get initial filter state from URL, merging with defaults
 * @param defaultFilters - Default filter state
 * @param searchParams - URLSearchParams to read from (optional, for SSR compatibility)
 */
export function getInitialFiltersFromURL(
  defaultFilters: Record<string, any>,
  searchParams?: URLSearchParams,
): Record<string, any> {
  // Use provided searchParams (from Remix) or fallback to current URL
  const params = searchParams || getCurrentSearchParams();
  const urlFilters = decodeFiltersFromURL(params);

  // If there are URL filters, use them (they override defaults)
  if (Object.keys(urlFilters).length > 0) {
    return urlFilters;
  }

  // If no URL filters, use defaults
  return defaultFilters;
}

/**
 * Get initial state (both filters and search) from URL
 * @param defaultFilters - Default filter state
 * @param defaultSearch - Default search term
 * @param searchParams - URLSearchParams to read from (optional, for SSR compatibility)
 */
export function getInitialStateFromURL(
  defaultFilters: Record<string, any>,
  defaultSearch: string = '',
  searchParams?: URLSearchParams,
): { filters: Record<string, any>; search: string } {
  return {
    filters: getInitialFiltersFromURL(defaultFilters, searchParams),
    search: getInitialSearchFromURL(defaultSearch, searchParams),
  };
}
