import React, { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Square } from 'lucide-react';
import { Button } from '../../button.js';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../Accordion.js';
import type { FilterDefinition } from './types.js';
import { cn } from '../../../../utils/cn.js';
import {
  isFilterActive,
  toggleFilter,
  getFilterCountKey,
  isAllFiltersActive,
  createAllFiltersState,
  ALL_FILTERS_KEY,
  getFilterId,
} from './filter-utils.js';

export interface ClientFilterBarWithAdvancedProps<T> {
  items: T[] | Promise<T[]>;
  filters: FilterDefinition[];
  activeFilters: Record<string, any>;
  setActiveFilters: (filters: Record<string, any>) => void;
  className?: string;
  customCountFunction?: (items: T[], filter: FilterDefinition) => number | undefined;

  // Props for basic/advanced split
  basicFilterKeys?: string[]; // Filter keys to show in basic section
  advancedFilterKeys?: string[]; // Filter keys to show in advanced section

  // Optional: Custom labels
  advancedSectionLabel?: string; // Default: "Advanced Filters"
  showAdvancedButtonText?: string; // Default: "Show Advanced"
  hideAdvancedButtonText?: string; // Default: "Hide Advanced"
}

/**
 * Shared filter button component used in both basic and advanced sections
 */
function FilterButton({
  filter,
  isActive,
  count,
  onClick,
}: {
  filter: FilterDefinition;
  isActive: boolean;
  count: number | null;
  onClick: () => void;
}) {
  return (
    <Button
      variant={isActive ? 'default' : 'ghost'}
      size="sm"
      onClick={onClick}
      className="flex items-center h-8 px-3 space-x-0"
    >
      {isActive ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
      <span className="flex items-center ml-1">
        {filter.label}
        {count === null ? (
          <span
            className={cn('inline-block ml-2 w-4 h-4 text-xs rounded animate-pulse', {
              'bg-blue-300': isActive,
              'bg-stone-300': !isActive,
            })}
          ></span>
        ) : (
          <span className="ml-1 text-xs opacity-75">({count})</span>
        )}
      </span>
    </Button>
  );
}

export function ClientFilterBarWithAdvanced<T>({
  items,
  filters,
  activeFilters,
  setActiveFilters,
  className = '',
  customCountFunction,
  basicFilterKeys,
  advancedFilterKeys,
  showAdvancedButtonText = 'show advanced',
  hideAdvancedButtonText = 'hide advanced',
}: ClientFilterBarWithAdvancedProps<T>) {
  const [resolvedItems, setResolvedItems] = useState<T[]>([]);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  useEffect(() => {
    if (Array.isArray(items)) {
      setResolvedItems(items);
    } else if (items instanceof Promise) {
      items.then((data) => {
        setResolvedItems(data);
      });
    }
  }, [items]);

  // Split filters into basic and advanced
  const { basicFilters, advancedFilters } = useMemo(() => {
    const basic: FilterDefinition[] = [];
    const advanced: FilterDefinition[] = [];

    filters.forEach((filter) => {
      if (basicFilterKeys && basicFilterKeys.includes(filter.key)) {
        basic.push(filter);
      } else if (advancedFilterKeys && advancedFilterKeys.includes(filter.key)) {
        advanced.push(filter);
      } else {
        // If no categorization specified, all go to basic (backward compatible)
        if (!basicFilterKeys && !advancedFilterKeys) {
          basic.push(filter);
        } else {
          // If categorization specified but filter doesn't match, default to basic
          basic.push(filter);
        }
      }
    });

    return { basicFilters: basic, advancedFilters: advanced };
  }, [filters, basicFilterKeys, advancedFilterKeys]);

  // Calculate filter counts
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    filters.forEach((filter) => {
      let customCount: number | undefined = undefined;

      // Try custom counting function first (if provided)
      if (customCountFunction) {
        customCount = customCountFunction(resolvedItems, filter);
      }

      // Use custom count if provided, otherwise fall back to automatic logic
      if (customCount !== undefined) {
        counts[`${filter.key}-${filter.value}`] = customCount;
      } else {
        // Existing automatic counting logic
        counts[`${filter.key}-${filter.value}`] = resolvedItems.filter((item) => {
          const itemValue = (item as any)[filter.key];

          if (typeof filter.value === 'boolean') {
            return !!itemValue === filter.value || String(itemValue) === String(filter.value);
          }

          if (typeof filter.value === 'string' && typeof itemValue === 'string') {
            return itemValue.toLowerCase() === filter.value.toLowerCase();
          }

          return itemValue === filter.value;
        }).length;
      }
    });
    return counts;
  }, [resolvedItems, filters, customCountFunction]);

  const handleFilterToggle = (filter: FilterDefinition) => {
    // If "All" is currently active, clicking any filter should clear "All" and activate only that filter
    if (isAllFiltersActive(activeFilters)) {
      const filterKey = filter.groupKey || getFilterId(filter);
      setActiveFilters({ [filterKey]: filter.groupKey ? filter.value : true });
      return;
    }

    // Check if this filter is currently active
    const isCurrentlyActive = isFilterActive(activeFilters, filter);

    if (isCurrentlyActive) {
      // If clicking an active filter to turn it off, use normal toggle
      const newFilters = toggleFilter(activeFilters, filter);

      // Check if any regular filters are still active after toggle
      const hasAnyRegularFilters = Object.keys(newFilters).some((key) => {
        if (key === ALL_FILTERS_KEY) return false;
        const value = newFilters[key];
        // For grouped filters, check if value exists and is not null/undefined
        // For independent filters, check if value is explicitly true
        return value != null && value !== false;
      });

      if (hasAnyRegularFilters) {
        setActiveFilters(newFilters);
      } else {
        // If no regular filters are active, activate "All"
        setActiveFilters(createAllFiltersState());
      }
    } else {
      // If clicking an inactive filter to turn it on, directly activate it
      const filterKey = filter.groupKey || getFilterId(filter);

      if (filter.groupKey) {
        // For grouped filters, replace the group value
        const newFilters = { ...activeFilters };
        newFilters[filter.groupKey] = filter.value;
        // Remove "All" if present
        delete newFilters[ALL_FILTERS_KEY];
        setActiveFilters(newFilters);
      } else {
        // For independent filters, add to existing (and remove "All")
        const newFilters = { ...activeFilters };
        newFilters[filterKey] = true;
        // Remove "All" if present
        delete newFilters[ALL_FILTERS_KEY];
        setActiveFilters(newFilters);
      }
    }
  };

  const handleAllClick = () => {
    // "All" is mutually exclusive - clear all other filters
    setActiveFilters(createAllFiltersState());
  };

  const isAllActive = isAllFiltersActive(activeFilters);

  // Group basic filters by groupKey for visual separation (same as original)
  const basicFilterGroups = useMemo(() => {
    const groups: { groupKey: string | null; filters: FilterDefinition[] }[] = [];
    const groupMap = new Map<string | null, FilterDefinition[]>();

    basicFilters.forEach((filter) => {
      const key = filter.groupKey || null;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(filter);
    });

    // Convert map to array, putting ungrouped filters first
    if (groupMap.has(null)) {
      groups.push({ groupKey: null, filters: groupMap.get(null)! });
    }

    Array.from(groupMap.entries())
      .filter(([key]) => key !== null)
      .sort(([a], [b]) => (a || '').localeCompare(b || ''))
      .forEach(([groupKey, groupFilters]) => {
        groups.push({ groupKey, filters: groupFilters });
      });

    return groups;
  }, [basicFilters]);

  // Group advanced filters by groupKey for row-based layout
  const advancedFilterGroups = useMemo(() => {
    const groups: { groupKey: string | null; filters: FilterDefinition[] }[] = [];
    const groupMap = new Map<string | null, FilterDefinition[]>();

    advancedFilters.forEach((filter) => {
      const key = filter.groupKey || null;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(filter);
    });

    // Sort groups: grouped filters first (sorted), then ungrouped at the end
    Array.from(groupMap.entries())
      .filter(([key]) => key !== null)
      .sort(([a], [b]) => (a || '').localeCompare(b || ''))
      .forEach(([groupKey, groupFilters]) => {
        groups.push({ groupKey, filters: groupFilters });
      });

    // Add ungrouped filters at the end
    if (groupMap.has(null)) {
      groups.push({ groupKey: null, filters: groupMap.get(null)! });
    }

    return groups;
  }, [advancedFilters]);

  const toggleAdvanced = () => {
    setIsAdvancedOpen(!isAdvancedOpen);
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-4 bg-gray-50 border-b border-gray-200 dark:bg-gray-900 dark:border-gray-700',
        { 'pb-1': isAdvancedOpen },
        className,
      )}
    >
      {/* Basic Filters Section */}
      <div className="flex flex-wrap items-center gap-4">
        {/* All Filter */}
        <Button
          variant={isAllActive ? 'default' : 'ghost'}
          size="sm"
          onClick={handleAllClick}
          className="flex items-center h-8 px-3 space-x-2"
        >
          {isAllActive ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          <span>
            All
            <span className="ml-1 text-xs opacity-75">({resolvedItems.length})</span>
          </span>
        </Button>

        {/* Separator between All and first group */}
        {basicFilterGroups.length > 0 && (
          <div className="w-px h-6 mx-1 bg-gray-300 dark:bg-gray-600" />
        )}

        {/* Basic Filter Groups with Separators */}
        {basicFilterGroups.map((group, groupIndex) => (
          <React.Fragment key={group.groupKey || 'ungrouped'}>
            {/* Visual separator before each group (except first) */}
            {groupIndex > 0 && <div className="w-px h-6 mx-1 bg-gray-300 dark:bg-gray-600" />}
            {/* Filter buttons in this group */}
            {group.filters.map((filter) => {
              const isActive = isFilterActive(activeFilters, filter);
              const countKey = getFilterCountKey(filter);
              const count = filterCounts[countKey] ?? filter.count ?? null;

              return (
                <FilterButton
                  key={`${filter.key}-${filter.value}`}
                  filter={filter}
                  isActive={isActive}
                  count={count}
                  onClick={() => handleFilterToggle(filter)}
                />
              );
            })}
          </React.Fragment>
        ))}

        {/* Show Advanced Button */}
        {advancedFilters.length > 0 && (
          <>
            <div className="w-px h-6 mx-1 bg-gray-300 dark:bg-gray-600" />
            <Button variant="link" size="sm" onClick={toggleAdvanced} className="h-8">
              {isAdvancedOpen ? hideAdvancedButtonText : showAdvancedButtonText}
            </Button>
          </>
        )}
      </div>

      {/* Advanced Filters Section (Collapsible) */}
      {advancedFilters.length > 0 && (
        <Accordion
          type="single"
          collapsible
          value={isAdvancedOpen ? 'advanced' : undefined}
          onValueChange={(value) => setIsAdvancedOpen(value === 'advanced')}
        >
          <AccordionItem
            value="advanced"
            className={cn('border-0', { 'border-t-1': isAdvancedOpen })}
          >
            {/* Hidden trigger - actual toggle is via the button above */}
            <AccordionTrigger className="sr-only" showChevron={false} />
            <AccordionContent className="pt-0 pb-0">
              <div className="flex flex-col">
                {advancedFilterGroups.map((group) => {
                  // Skip empty groups
                  if (group.filters.length === 0) return null;

                  // Format group label: replace hyphens/underscores with spaces and capitalize each word
                  const groupLabel =
                    group.groupKey === null
                      ? 'Other'
                      : group.groupKey
                          .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
                          .split(/\s+/) // Split by whitespace
                          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize first letter, lowercase rest
                          .join(' ');

                  return (
                    <div
                      key={group.groupKey || 'ungrouped'}
                      className="flex flex-row items-center gap-4 py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                    >
                      {/* Group Label */}
                      <div className="min-w-[120px] text-sm text-gray-700 dark:text-gray-300">
                        {groupLabel}
                      </div>
                      {/* Filter Buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        {group.filters.map((filter) => {
                          const isActive = isFilterActive(activeFilters, filter);
                          const countKey = getFilterCountKey(filter);
                          const count = filterCounts[countKey] ?? filter.count ?? null;

                          return (
                            <FilterButton
                              key={`${filter.key}-${filter.value}`}
                              filter={filter}
                              isActive={isActive}
                              count={count}
                              onClick={() => handleFilterToggle(filter)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
