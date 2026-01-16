import type { $Enums } from '@curvenote/scms-db';
import type { WorkCardDBO } from './WorkListItem';
import { ui } from '@curvenote/scms-core';

/**
 * Type for works with user role information
 */
export type WorkWithRole = WorkCardDBO & {
  userRole: $Enums.WorkRole | 'ORPHANED';
  // Add computed fields for filter counting
  sites: string[];
};

/**
 * Role mapping to friendly labels for group headers
 */
export const ROLE_LABELS: Record<$Enums.WorkRole | 'ORPHANED', string> = {
  OWNER: 'Owned By Me',
  CONTRIBUTOR: 'Contributing To',
  VIEWER: 'Viewing',
  ORPHANED: 'Other Works',
};

/**
 * Role precedence order for sorting groups
 * Using string prefixes that will sort correctly alphabetically
 */
export const ROLE_ORDER: Record<$Enums.WorkRole | 'ORPHANED', string> = {
  OWNER: '1-OWNER',
  CONTRIBUTOR: '2-CONTRIBUTOR',
  VIEWER: '3-VIEWER',
  ORPHANED: '4-ORPHANED',
};

/**
 * Search function for works - searches across title, authors, and DOI fields
 */
export function searchWorks(works: WorkWithRole[], searchTerm: string): WorkWithRole[] {
  if (!searchTerm.trim()) {
    return works;
  }

  const searchLower = searchTerm.toLowerCase();

  return works.filter((work) => {
    const latestVersion = work.versions[0];
    if (!latestVersion) return false;

    // Search in work version title
    if (latestVersion.title?.toLowerCase().includes(searchLower)) {
      return true;
    }

    // Search in authors
    if (latestVersion.authors?.some((author) => author.toLowerCase().includes(searchLower))) {
      return true;
    }

    // Search in work DOI
    if (work.doi?.toLowerCase().includes(searchLower)) {
      return true;
    }

    // Search in work version DOI
    if (latestVersion.doi?.toLowerCase().includes(searchLower)) {
      return true;
    }

    return false;
  });
}

/**
 * Extract all unique sites from works for filter generation
 */
export function extractSitesFromWorks(works: WorkWithRole[]): string[] {
  const sites = new Set<string>();

  works.forEach((work) => {
    work.sites.forEach((siteName) => {
      sites.add(siteName);
    });
  });

  return [...Array.from(sites)].sort();
}

/**
 * Generate site filter definitions dynamically from works data
 * Includes count calculation for each site
 */
export function generateSiteFilters(works: WorkWithRole[]): ui.FilterDefinition[] {
  const sites = extractSitesFromWorks(works);

  return sites.map((siteName) => {
    // Calculate count of works that have submissions to this site
    const count = works.filter((work) => work.sites.includes(siteName)).length;

    return {
      key: 'site',
      value: siteName,
      label: siteName,
      groupKey: 'site', // All site filters in same group for mutual exclusivity
      count, // Pre-calculated count for display
    };
  });
}

/**
 * Type definition for work-specific filter functions
 */
type WorkFilterFunction = (work: WorkWithRole, filterValue: any) => boolean;

/**
 * Field-specific filter implementations for works
 */
const workFilterFunctions: Record<string, WorkFilterFunction> = {
  /**
   * Site filtering - check if work has submissions to the specified site
   */
  site: (work, siteName) => {
    return work.sites.includes(siteName);
  },
};

/**
 * Filter function that combines search with site filters
 */
export function filterWorks(
  works: WorkWithRole[],
  searchTerm: string,
  activeFilters: Record<string, any>,
  filters: ui.FilterDefinition[] = [],
): WorkWithRole[] {
  // Apply search filtering first
  let filtered = searchWorks(works, searchTerm);

  // If "All" is explicitly selected, return search results without additional filtering
  if (ui.isAllFiltersActive(activeFilters)) {
    return filtered;
  }

  // Apply site filters
  filtered = filtered.filter((work) => {
    return filters.every((filter) => {
      // Check if this filter is currently active
      if (!ui.isFilterActive(activeFilters, filter)) {
        return true; // If filter is not active, don't filter out the item
      }

      // Get the field-specific filter function
      const filterFunction = workFilterFunctions[filter.key];
      if (!filterFunction) {
        console.warn(`No filter function found for key: ${filter.key}`);
        return true; // Default to not filtering if no function is found
      }

      // Apply the filter function with the filter's value
      return filterFunction(work, filter.value);
    });
  });

  return filtered;
}

/**
 * Get the role label for display in group headers
 */
export function getRoleLabel(role: string): string {
  // Extract the actual role from the sortable key (e.g., "1-OWNER" -> "OWNER")
  const actualRole = role.includes('-') ? role.split('-')[1] : role;
  return ROLE_LABELS[actualRole as $Enums.WorkRole | 'ORPHANED'] || actualRole;
}

/**
 * Get the sortable group key for a work based on user role
 */
export function getWorkGroupKey(work: WorkWithRole): string {
  return ROLE_ORDER[work.userRole] || ROLE_ORDER.ORPHANED;
}

/**
 * Transform works for ClientFilterBar counting - adds primary site field
 */
export function transformWorksForFilterBar(works: WorkWithRole[]): WorkWithRole[] {
  return works.map((work) => {
    // For counting purposes, use the first site alphabetically as the primary site
    // This allows ClientFilterBar's simple counting logic to work
    const primarySite = [...work.sites].sort()[0] || null;

    return {
      ...work,
      site: primarySite, // Add top-level site field for ClientFilterBar counting
    };
  });
}

/**
 * Sort works within a group by date created (newest first)
 */
export function sortWorksInGroup(works: WorkWithRole[]): WorkWithRole[] {
  return [...works].sort((a, b) => {
    return Date.parse(b.date_created) - Date.parse(a.date_created);
  });
}
