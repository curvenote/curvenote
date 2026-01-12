/**
 * Simple Filter Navigate - Query-Based Filtered Lists
 *
 * This module provides a set of components for implementing simple query-based filtered lists
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
 * ## What This Component Does
 *
 * This pattern implements a **server-side query-based filtering system** that:
 *
 * 1. **URL State Management**: All filter and search state is maintained in the URL query string
 * 2. **Server-Side Filtering**: Each filter change triggers a server request with the new query parameters
 * 3. **Debounced Search**: Search input is debounced to avoid excessive server requests
 * 4. **Navigation-Based**: Uses Remix's navigation system for state changes
 * 5. **Error Handling**: Provides consistent error states and loading indicators
 * 6. **Accessibility**: Full keyboard navigation and screen reader support
 *
 * The pattern works by:
 * - Parsing URL query parameters into a structured query object
 * - Applying filters at the database level using Prisma or similar ORM
 * - Returning filtered results with updated counts
 * - Rebuilding the URL with new query parameters
 * - Re-rendering the list with new data
 *
 * ## Core Components:
 *
 * ### FilterableList<T>
 * The main container component that renders the list with search and filter slots.
 * Handles error states, empty states, and responsive item layout.
 *
 * ### QuerySearch<TQuery>
 * Generic search component with debounced input that updates URL query parameters.
 * Configurable placeholder text, result labels, and debounce timing.
 *
 * ### FilterBar<TQuery>
 * Generic filter bar component that renders filter buttons and manages active states.
 * Supports custom filter definitions and query logic.
 *
 * ## Backend Requirements
 *
 * ### Loader Function Requirements:
 *
 * ```typescript
 * export const loader = async (args: LoaderFunctionArgs) => {
 *   const url = new URL(args.request.url);
 *   const qValue = url.searchParams.get('q') || '';
 *
 *   // Parse query string into structured object
 *   let query: YourQueryType = {};
 *   if (qValue) {
 *     query = parseQuery(qValue);
 *   }
 *
 *   // Apply filters to database query
 *   const items = await dbGetItemsWithFilters(query);
 *   const counts = await dbGetFilterCounts();
 *
 *   return json({ items, counts, query });
 * };
 * ```
 *
 * ### Query Parser Requirements:
 *
 * ```typescript
 * // Parse query from URL string
 * export function parseQuery(qValue: string): YourQueryType {
 *   try {
 *     const decodedQuery = decodeURIComponent(qValue);
 *     const searchParams = new URLSearchParams(decodedQuery);
 *
 *     // Extract and validate parameters
 *     const params: Record<string, string> = {};
 *     for (const [key, value] of searchParams.entries()) {
 *       params[key] = value;
 *     }
 *
 *     return YourQuerySchema.parse(params);
 *   } catch (error) {
 *     return {};
 *   }
 * }
 *
 * // Build query string from object
 * export function buildQuery(query: YourQueryType): string {
 *   const params = new URLSearchParams();
 *
 *   if (query.search?.trim()) {
 *     params.set('search', query.search.trim());
 *   }
 *
 *   // Add other filter parameters
 *   if (query.status) params.set('status', query.status);
 *   if (query.category) params.set('category', query.category);
 *
 *   return params.toString();
 * }
 * ```
 *
 * ### Database Query Requirements:
 *
 * ```typescript
 * export async function dbGetItemsWithFilters(query: YourQueryType) {
 *   const where: Prisma.YourModelWhereInput = {};
 *
 *   // Apply search filter
 *   if (query.search?.trim()) {
 *     where.OR = [
 *       { title: { contains: query.search, mode: 'insensitive' } },
 *       { description: { contains: query.search, mode: 'insensitive' } },
 *     ];
 *   }
 *
 *   // Apply other filters
 *   if (query.status) where.status = query.status;
 *   if (query.category) where.category = query.category;
 *
 *   return await prisma.yourModel.findMany({
 *     where,
 *     orderBy: { createdAt: 'desc' },
 *   });
 * }
 * ```
 *
 * ## Usage Example:
 *
 * ```typescript
 * <FilterableList
 *   searchComponent={
 *     <QuerySearch
 *       searchTerm={query?.search}
 *       resultCount={items.length}
 *       placeholder="Search items..."
 *       resultLabel="item"
 *       parseQuery={parseQuery}
 *       buildQuery={buildQuery}
 *       updateQuerySearch={(q, search) => ({ ...q, search })}
 *     />
 *   }
 *   filterBar={
 *     <FilterBar
 *       filters={[
 *         { key: 'status', value: 'active', label: 'Active' },
 *         { key: 'status', value: 'inactive', label: 'Inactive' }
 *       ]}
 *       parseQuery={parseQuery}
 *       buildQuery={buildQuery}
 *       isFilterActive={(q, key, value) => q[key] === value}
 *       updateQuery={(q, key, value) => ({ ...q, [key]: value })}
 *       clearFilters={(q) => ({ search: q.search })}
 *       hasActiveFilters={(q) => Object.keys(q).some(k => k !== 'search')}
 *     />
 *   }
 *   items={items}
 *   renderItem={(item) => <ItemComponent item={item} />}
 *   error={error}
 *   emptyMessage="No items found."
 * />
 * ```
 *
 * ## Common Pitfalls and Considerations:
 *
 * 1. **Query String Encoding**: Always properly encode/decode query strings to handle special characters
 * 2. **Error Handling**: Provide fallbacks for malformed query strings
 * 3. **Performance**: Use database indexes for filtered fields to maintain performance
 * 4. **Debouncing**: Configure appropriate debounce timing for your use case (default: 300ms)
 * 5. **Counts**: Pre-calculate filter counts to avoid N+1 queries
 * 6. **Validation**: Use Zod or similar for query parameter validation
 * 7. **Caching**: Consider caching frequently accessed filtered results
 *
 * ## Requirements:
 * - Remix with useSearchParams hook
 * - Query parser/builder functions for your query schema
 * - Server-side loader that responds to URL query parameters
 * - Database with proper indexes on filtered fields
 */

// Core Components
export { FilterableList } from './components/filterable-list.js';
export type { FilterableListProps } from './components/filterable-list.js';

export { QuerySearch } from './components/query-search.js';
export type { QuerySearchProps } from './components/query-search.js';

export { FilterBar } from './components/filter-bar.js';
export type { FilterBarProps } from './components/filter-bar.js';
export type { FilterDefinition } from './components/types.js';
