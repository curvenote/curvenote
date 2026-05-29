/**
 * Client-Side Filterable List - Memory-Based Filtered Lists
 *
 * This module provides components for implementing client-side filtered lists with instant
 * filtering, search, and optional grouping. All data is loaded upfront and filtered in memory
 * for instant results without server round-trips.
 *
 * Key Features:
 * - Instant client-side filtering and search
 * - Optional grouping with consistent styling
 * - Support for both flat and grouped list displays
 * - Built-in promise handling (no external Suspense needed)
 *
 * Quick Start:
 * - Use ClientFilterableList for the main container
 * - Add optional groupBy/renderGroup props for grouping
 * - Use GroupedItems utility for consistent group styling
 * - Best for small-medium datasets (< 1000 items)
 */

export { ClientFilterableList } from './client-filterable-list.js';
export type { ClientFilterableListProps } from './client-filterable-list.js';

export { ClientQuerySearch } from './client-query-search.js';
export type { ClientQuerySearchProps } from './client-query-search.js';

export { ClientFilterBar } from './client-filter-bar.js';
export type { ClientFilterBarProps } from './client-filter-bar.js';

export { ClientFilterBarWithAdvanced } from './client-filter-bar-with-advanced.js';
export type { ClientFilterBarWithAdvancedProps } from './client-filter-bar-with-advanced.js';

export * from './url-state-utils.js';
