/**
 * Generic filter function pattern for domain-specific implementations.
 *
 * This provides a common interface that can be implemented by different modules
 * while keeping the actual filter logic close to the domain-specific types.
 */

import type { FilterDefinition } from './types.js';

/**
 * Generic filter function type that can be specialized for any item type.
 *
 * @template T - The type of item being filtered (e.g., NormalizedScientist, Submission)
 */
export type FilterFunction<T> = (item: T, filterValue: any) => boolean;

/**
 * Type for a registry of filter functions keyed by field name.
 *
 * @template T - The type of item being filtered
 */
export type FilterFunctionRegistry<T> = Record<string, FilterFunction<T>>;

/**
 * Generic filter implementation function type.
 * This is the signature that domain-specific filter functions should follow.
 *
 * @template T - The type of item being filtered
 */
export type GenericFilterImplementation<T> = (
  items: T[],
  activeFilters: Record<string, any>,
  filters: FilterDefinition[],
) => T[];

/**
 * Helper type to extract the item type from a filter implementation function.
 */
export type ExtractItemType<T> = T extends GenericFilterImplementation<infer U> ? U : never;

/**
 * Configuration object for setting up a complete filtering system.
 *
 * @template T - The type of item being filtered
 */
export interface FilterSystemConfig<T> {
  /** Filter definitions for this domain */
  filters: FilterDefinition[];
  /** Registry of field-specific filter functions */
  filterFunctions: FilterFunctionRegistry<T>;
  /** Main filter implementation function */
  filterImplementation: GenericFilterImplementation<T>;
}
