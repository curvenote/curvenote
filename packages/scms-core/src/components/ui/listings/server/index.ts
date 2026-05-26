/**
 * Server Filter Navigate - Query-Based Filtered Lists
 *
 * This module provides a set of components for implementing query-based filtered lists
 * with no pagination. These components work together to create a complete list interface that:
 *
 * - Uses the main URL query string for filtering and search state
 * - Triggers navigation when filters/search change (server-side filtering)
 * - Provides debounced search with configurable delay
 * - Maintains filter state across page refreshes and navigation
 * - Supports error states and empty list messaging
 * - Fully accessible with keyboard navigation
 *
 * ## When to Use This Component
 *
 * Use this pattern when you need:
 * - **Server-side filtering** for large datasets that would be inefficient to load entirely client-side
 * - **URL state management** for bookmarkable and shareable filtered views
 * - **Complex search requirements** that need database-level filtering (full-text search, multiple fields)
 * - **Real-time data accuracy** where client-side filtering might miss recent changes
 * - **SEO-friendly URLs** that reflect the current filter state
 * - **Database-level performance** for complex queries that would be slow in memory
 *
 * **Do NOT use this pattern when:**
 * - You have small to medium datasets (< 1000 items) that can be loaded entirely client-side
 * - You need instant filtering without server round-trips
 * - You want to avoid complex server-side query logic
 * - Performance is more important than data accuracy
 *
 * ## Core Components
 *
 * - **FilterableList** — list shell with search/filter slots, empty and error states
 * - **QuerySearch** — debounced search that updates the URL `q` param
 * - **FilterBar** — filter buttons that update the URL `q` param
 *
 * Pair with a route loader that parses `q`, queries the database, and returns items + counts.
 */

export { FilterableList } from './filterable-list.js';
export type { FilterableListProps } from './filterable-list.js';

export { QuerySearch } from './query-search.js';
export type { QuerySearchProps } from './query-search.js';

export { FilterBar } from './filter-bar.js';
export type { FilterBarProps } from './filter-bar.js';
