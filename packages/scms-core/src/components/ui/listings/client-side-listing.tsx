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
 * - Backward compatible design
 *
 * For complete documentation, usage examples, and best practices, see:
 * ./client-side-filter.md
 *
 * Quick Start:
 * - Use ClientFilterableList for the main container
 * - Add optional groupBy/renderGroup props for grouping
 * - Use GroupedItems utility for consistent group styling
 * - Best for small-medium datasets (< 1000 items)
 */

// Core Components
export { ClientFilterableList } from './components/client-filterable-list.js';
export type { ClientFilterableListProps } from './components/client-filterable-list.js';

export { ClientQuerySearch } from './components/client-query-search.js';
export type { ClientQuerySearchProps } from './components/client-query-search.js';

export { ClientFilterBar } from './components/client-filter-bar.js';
export type { ClientFilterBarProps } from './components/client-filter-bar.js';
export type { FilterDefinition } from './components/types.js';

// Grouping Utilities
export {
  GroupedItems,
  GroupHeader,
  calculateGlobalStartIndex,
} from './components/grouped-items.js';
export type { GroupedItemsProps, GroupHeaderProps } from './components/grouped-items.js';
