import { ui, useDeploymentConfig } from '@curvenote/scms-core';
import { UserClientSearch } from './UserClientSearch';
import { UserListItem } from './UserListItem';
import {
  filterUsersWithSearch,
  transformUsersForFilterBar,
  generateAllUserFilters,
  userFilterFunctions,
} from './UserListingHelpers';
import type { UserDTO } from './db.server';

interface PlatformUserListProps {
  users: UserDTO[];
  availableRoles: any[];
}

export function PlatformUserList({ users, availableRoles }: PlatformUserListProps) {
  const config = useDeploymentConfig();

  // Generate filters based on deployment config and available roles
  const allFilters = generateAllUserFilters(config, availableRoles);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renderItem = (user: UserDTO, _globalIndex: number, _localIndex?: number) => (
    <UserListItem user={user} availableRoles={availableRoles} />
  );

  return (
    <div className="space-y-4">
      <ui.ClientFilterableList
        items={users}
        filters={allFilters}
        persist={true}
        searchComponent={(searchTerm, setSearchTerm) => (
          <UserClientSearch searchTerm={searchTerm} onSearchChange={setSearchTerm} />
        )}
        filterBar={(resolvedUsers, activeFilters, setActiveFilters, filterDefinitions) => (
          <ui.ClientFilterBar
            items={transformUsersForFilterBar(resolvedUsers)}
            filters={filterDefinitions}
            activeFilters={activeFilters}
            setActiveFilters={setActiveFilters}
            customCountFunction={(items, filter) => {
              // Use existing filter functions for complex cases
              const filterFunction = userFilterFunctions[filter.key];
              if (filterFunction) {
                return items.filter((user) => filterFunction(user, filter.value)).length;
              }
              // Return undefined to let ClientFilterBar use default logic
              return undefined;
            }}
          />
        )}
        filterItems={(userList, searchTerm, activeFilters) => {
          return filterUsersWithSearch(userList, searchTerm, activeFilters, allFilters);
        }}
        renderItem={renderItem}
        getItemKey={(user) => user.id}
        emptyMessage="No users found."
        className=""
      />
    </div>
  );
}
