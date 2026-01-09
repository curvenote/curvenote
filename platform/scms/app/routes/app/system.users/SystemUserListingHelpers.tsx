import { ui } from '@curvenote/scms-core';
import type { SystemUserDTO } from './db.server';

/**
 * Search function for system users - searches across name, email, username
 */
export function searchSystemUsers(users: SystemUserDTO[], searchTerm: string): SystemUserDTO[] {
  if (!searchTerm.trim()) return users;

  const searchLower = searchTerm.toLowerCase();
  return users.filter(
    (user) =>
      user.display_name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.username?.toLowerCase().includes(searchLower),
  );
}

/**
 * Generate system role filters for the filter bar
 */
export function generateSystemRoleFilters(): ui.FilterDefinition[] {
  const systemRoles = ['USER', 'ADMIN', 'PLATFORM_ADMIN', 'SERVICE', 'ANON'];

  return systemRoles.map((role) => ({
    key: 'systemRole',
    value: role,
    label:
      role === 'USER'
        ? 'User'
        : role === 'PLATFORM_ADMIN'
          ? 'Platform Admin'
          : role.charAt(0) + role.slice(1).toLowerCase(),
    groupKey: 'systemRole',
    default: false,
  }));
}

/**
 * Type definition for system user-specific filter functions
 */
type SystemUserFilterFunction = (user: SystemUserDTO, filterValue: any) => boolean;

/**
 * Field-specific filter implementations for system users
 */
export const systemUserFilterFunctions: Record<string, SystemUserFilterFunction> = {
  /**
   * System role filtering
   */
  systemRole: (user, value) => {
    return user.system_role === value;
  },
};

/**
 * Combined filter function for system users using filter definitions
 */
export function filterSystemUsers(
  users: SystemUserDTO[],
  activeFilters: Record<string, any>,
  filters: ui.FilterDefinition[],
): SystemUserDTO[] {
  return users.filter((user) => {
    return filters.every((filter) => {
      // Check if this filter is currently active
      if (!ui.isFilterActive(activeFilters, filter)) {
        return true; // If filter is not active, don't filter out the item
      }

      // Get the field-specific filter function
      const filterFunction = systemUserFilterFunctions[filter.key];
      if (!filterFunction) {
        console.warn(`No filter function found for key: ${filter.key}`);
        return true; // Default to not filtering if no function is found
      }

      // Apply the filter function with the filter's value
      return filterFunction(user, filter.value);
    });
  });
}

/**
 * Transform system users for filter bar (used for counting)
 */
export function transformSystemUsersForFilterBar(users: SystemUserDTO[]) {
  return users.map((user) => ({
    ...user,
    systemRole: user.system_role,
  }));
}

/**
 * Generate all filters for system users (just system roles for now)
 */
export function generateAllSystemUserFilters(): ui.FilterDefinition[] {
  return generateSystemRoleFilters();
}

/**
 * Main filter function that combines search with all filters
 */
export function filterSystemUsersWithSearch(
  users: SystemUserDTO[],
  searchTerm: string,
  activeFilters: Record<string, any>,
  filters: ui.FilterDefinition[],
): SystemUserDTO[] {
  // Apply search filtering first
  let filtered = searchSystemUsers(users, searchTerm);

  // Then apply other filters
  filtered = filterSystemUsers(filtered, activeFilters, filters);

  return filtered;
}
