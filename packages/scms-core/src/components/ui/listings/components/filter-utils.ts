import type { FilterDefinition } from './types.js';

// Special key for "All" filter state
export const ALL_FILTERS_KEY = '__all_filters';

/**
 * Generate a unique filter ID for independent filters
 * Format: "key_value" (e.g., "status_pending")
 */
export function getFilterId(filter: FilterDefinition): string {
  return `${filter.key}_${filter.value}`;
}

/**
 * Check if a filter is currently active
 */
export function isFilterActive(
  activeFilters: Record<string, any>,
  filter: FilterDefinition,
): boolean {
  if (filter.groupKey) {
    // Grouped filter: check if this filter's value is active in the group
    return activeFilters[filter.groupKey] === filter.value;
  } else {
    // Independent filter: check if filter ID is active
    const filterId = getFilterId(filter);
    return activeFilters[filterId] === true;
  }
}

/**
 * Toggle a filter's active state
 */
export function toggleFilter(
  activeFilters: Record<string, any>,
  filter: FilterDefinition,
): Record<string, any> {
  const newFilters = { ...activeFilters };

  if (filter.groupKey) {
    // Grouped filter: mutual exclusivity within group
    if (activeFilters[filter.groupKey] === filter.value) {
      // Remove from group (deactivate)
      delete newFilters[filter.groupKey];
    } else {
      // Set as active in group (replaces any other active filter in group)
      newFilters[filter.groupKey] = filter.value;
    }
  } else {
    // Independent filter: simple toggle
    const filterId = getFilterId(filter);
    if (activeFilters[filterId]) {
      // Remove independent filter
      delete newFilters[filterId];
    } else {
      // Add independent filter
      newFilters[filterId] = true;
    }
  }

  return newFilters;
}

/**
 * Build default filters from filter definitions
 * If no filters have default=true, returns the "All" state
 */
export function buildDefaultFilters(filters: FilterDefinition[]): Record<string, any> {
  const defaultFilters: Record<string, any> = {};
  let hasAnyDefaults = false;

  filters.forEach((filter) => {
    if (filter.default) {
      hasAnyDefaults = true;
      if (filter.groupKey) {
        // Grouped filter: set the group to this filter's value
        // Note: If multiple filters in a group have default=true, last one wins
        defaultFilters[filter.groupKey] = filter.value;
      } else {
        // Independent filter: set the filter ID to true
        const filterId = getFilterId(filter);
        defaultFilters[filterId] = true;
      }
    }
  });

  // If no filters have default=true, default to "All" state
  if (!hasAnyDefaults) {
    return createAllFiltersState();
  }

  return defaultFilters;
}

/**
 * Calculate filter counts for display badges
 */
export function calculateFilterCounts<T>(
  items: T[],
  filters: FilterDefinition[],
): Record<string, number> {
  const counts: Record<string, number> = {};

  filters.forEach((filter) => {
    const filterKey = filter.groupKey ? `${filter.groupKey}-${filter.value}` : getFilterId(filter);

    counts[filterKey] = items.filter((item) => {
      const itemValue = (item as any)[filter.key];

      if (typeof filter.value === 'boolean') {
        return !!itemValue === filter.value || String(itemValue) === String(filter.value);
      }

      if (typeof filter.value === 'string' && typeof itemValue === 'string') {
        return itemValue.toLowerCase() === filter.value.toLowerCase();
      }

      return itemValue === filter.value;
    }).length;
  });

  return counts;
}

/**
 * Helper to get the display key for filter counting
 * This matches the key format used by ClientFilterBar
 */
export function getFilterCountKey(filter: FilterDefinition): string {
  return `${filter.key}-${filter.value}`;
}

/**
 * Check if "All" filter state is active (explicit all, not just empty)
 */
export function isAllFiltersActive(activeFilters: Record<string, any>): boolean {
  return activeFilters[ALL_FILTERS_KEY] === true;
}

/**
 * Create "All" filter state
 */
export function createAllFiltersState(): Record<string, any> {
  return { [ALL_FILTERS_KEY]: true };
}
