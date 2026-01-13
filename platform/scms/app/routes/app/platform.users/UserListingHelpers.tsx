import type { ClientDeploymentConfig } from '@curvenote/scms-core';
import { ui } from '@curvenote/scms-core';
import type { UserDTO } from './db.server';

/**
 * Search function for users - searches across name, email, username, and provider
 */
export function searchUsers(users: UserDTO[], searchTerm: string): UserDTO[] {
  if (!searchTerm.trim()) return users;

  const searchLower = searchTerm.toLowerCase();
  return users.filter(
    (user) =>
      user.display_name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.username?.toLowerCase().includes(searchLower) ||
      user.primaryProvider?.toLowerCase().includes(searchLower),
  );
}

/**
 * Generate provider filters from deployment config
 */
export function generateProviderFilters(config: ClientDeploymentConfig): ui.FilterDefinition[] {
  const availableProviders = config.authProviders || [];
  const filters: ui.FilterDefinition[] = [];

  availableProviders.forEach((provider) => {
    if (provider.provider === 'firebase') {
      // Create two separate Firebase filters
      filters.push({
        key: 'provider',
        value: 'firebase-google',
        label: 'Curvenote (google)',
        groupKey: 'provider',
        default: false,
      });
      filters.push({
        key: 'provider',
        value: 'firebase-email',
        label: 'Curvenote (email)',
        groupKey: 'provider',
        default: false,
      });
    } else {
      // Standard provider filter
      filters.push({
        key: 'provider',
        value: provider.provider,
        label: getProviderDisplayName(provider.provider),
        groupKey: 'provider',
        default: false,
      });
    }
  });

  return filters;
}

/**
 * Static status filters
 */
export const STATUS_FILTERS: ui.FilterDefinition[] = [
  {
    key: 'status',
    value: 'pending',
    label: 'Pending',
    groupKey: 'status',
    default: false,
  },
  {
    key: 'status',
    value: 'awaiting-approval',
    label: 'Awaiting Approval',
    groupKey: 'status',
    default: false,
  },
  {
    key: 'status',
    value: 'disabled',
    label: 'Disabled',
    groupKey: 'status',
    default: false,
  },
];

/**
 * Generate system role filters with groupKey for mutual exclusivity
 */
export function generateSystemRoleFilters(): ui.FilterDefinition[] {
  const systemRoles = ['USER', 'ADMIN', 'PLATFORM_ADMIN', 'SERVICE'];

  return systemRoles.map((role) => ({
    key: 'systemRole',
    value: role,
    label: role === 'USER' ? 'User' : role.charAt(0) + role.slice(1).toLowerCase(),
    groupKey: 'with',
    default: false,
  }));
}

/**
 * Generate role filters based on available roles in the system
 */
export function generateRoleFilters(availableRoles: any[]): ui.FilterDefinition[] {
  return availableRoles.map((role) => ({
    key: 'role',
    value: role.name,
    label: role.title,
    groupKey: 'role',
    default: false,
  }));
}

/**
 * Get display name for provider
 */
function getProviderDisplayName(provider: string): string {
  const displayNames: Record<string, string> = {
    orcid: 'ORCID',
    google: 'Google',
    github: 'GitHub',
    okta: 'Okta',
    firebase: 'Curvenote',
    'firebase-google': 'Firebase Google',
    'firebase-email': 'Firebase Email',
  };
  return (
    displayNames[provider.toLowerCase()] || provider.charAt(0).toUpperCase() + provider.slice(1)
  );
}

/**
 * Type definition for user-specific filter functions
 */
type UserFilterFunction = (user: UserDTO, filterValue: any) => boolean;

/**
 * Field-specific filter implementations for users
 */
export const userFilterFunctions: Record<string, UserFilterFunction> = {
  /**
   * Provider filtering with special handling for Firebase subtypes
   */
  provider: (user, value) => {
    // Handle Firebase subtypes
    if (value === 'firebase-google') {
      return (
        user.primaryProvider === 'google' &&
        user.linkedAccounts.some((account) => account.provider === 'google')
      );
    }

    // Standard provider matching
    return (
      user.primaryProvider === value ||
      user.linkedAccounts.some((account) => account.provider === value)
    );
  },

  /**
   * Status filtering
   */
  status: (user, value) => {
    switch (value) {
      case 'pending':
        return user.pending === true;
      case 'awaiting-approval':
        return user.ready_for_approval === true;
      case 'disabled':
        return user.disabled === true;
      default:
        return true;
    }
  },

  /**
   * System role filtering
   */
  systemRole: (user, value) => {
    return user.system_role === value;
  },

  /**
   * Role filtering - check if user has the specified role
   */
  role: (user, value) => {
    return user.roles.some((userRole) => userRole.role.name === value);
  },
};

/**
 * Combined filter function for users using filter definitions
 */
export function filterUsers(
  users: UserDTO[],
  activeFilters: Record<string, any>,
  filters: ui.FilterDefinition[],
): UserDTO[] {
  return users.filter((user) => {
    return filters.every((filter) => {
      // Check if this filter is currently active
      if (!ui.isFilterActive(activeFilters, filter)) {
        return true; // If filter is not active, don't filter out the item
      }

      // Get the field-specific filter function
      const filterFunction = userFilterFunctions[filter.key];
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
 * Transform users for filter bar (used for counting)
 * Create custom counting logic that matches our filter functions
 */
export function transformUsersForFilterBar(users: UserDTO[]) {
  return users.map((user) => ({
    ...user,
    // Decorate with computed properties that match our filter keys and values
    provider: getProviderFilterValue(user),
    status: getStatusFilterValues(user),
    systemRole: user.system_role,
    // Add role information for filtering (using different property name to avoid conflict)
    roleNames: user.roles.map((userRole) => userRole.role.name),
  }));
}

/**
 * Get the provider filter value for a user, handling Firebase subtypes
 */
function getProviderFilterValue(user: UserDTO): string {
  if (user.primaryProvider === 'firebase') {
    // For Firebase users, determine if they use Google or email authentication
    const hasGoogleAccount = user.linkedAccounts.some((account) => account.provider === 'google');
    return hasGoogleAccount ? 'firebase-google' : 'firebase-email';
  }

  return user.primaryProvider || '';
}

/**
 * Get the status filter values for a user
 */
function getStatusFilterValues(user: UserDTO): string | undefined {
  if (user.disabled === true) {
    return 'disabled';
  } else if (user.ready_for_approval === true) {
    return 'awaiting-approval';
  } else if (user.pending === true) {
    return 'pending';
  }

  return undefined;
}

/**
 * Calculate filter counts using our custom filter functions
 */
export function calculateUserFilterCounts(
  users: UserDTO[],
  filters: ui.FilterDefinition[],
): Record<string, number> {
  const counts: Record<string, number> = {};

  filters.forEach((filter) => {
    const filterKey = `${filter.key}-${filter.value}`;
    const filterFunction = userFilterFunctions[filter.key];

    if (filterFunction) {
      counts[filterKey] = users.filter((user) => filterFunction(user, filter.value)).length;
    } else {
      // Fallback to direct property access for unknown filters
      counts[filterKey] = users.filter((user) => (user as any)[filter.key] === filter.value).length;
    }
  });

  return counts;
}

/**
 * Generate all filters (providers + status + system roles + roles)
 */
export function generateAllUserFilters(
  config: ClientDeploymentConfig,
  availableRoles: any[] = [],
): ui.FilterDefinition[] {
  const providerFilters = generateProviderFilters(config);
  const systemRoleFilters = generateSystemRoleFilters();
  const roleFilters = generateRoleFilters(availableRoles);
  return [...providerFilters, ...STATUS_FILTERS, ...systemRoleFilters, ...roleFilters];
}

/**
 * Main filter function that combines search with all filters
 */
export function filterUsersWithSearch(
  users: UserDTO[],
  searchTerm: string,
  activeFilters: Record<string, any>,
  filters: ui.FilterDefinition[],
): UserDTO[] {
  // Apply search filtering first
  let filtered = searchUsers(users, searchTerm);

  // Then apply other filters
  filtered = filterUsers(filtered, activeFilters, filters);

  return filtered;
}
