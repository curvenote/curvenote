import { ui } from '@curvenote/scms-core';
import { SystemUserClientSearch } from './SystemUserClientSearch';
import { SystemUserListItem } from './SystemUserListItem';
import {
  filterSystemUsersWithSearch,
  transformSystemUsersForFilterBar,
  generateAllSystemUserFilters,
  systemUserFilterFunctions,
} from './SystemUserListingHelpers';
import type { SystemUserDTO } from './db.server';

interface SystemUserListProps {
  users: SystemUserDTO[];
  currentUserId: string;
}

export function SystemUserList({ users, currentUserId }: SystemUserListProps) {
  // Generate filters
  const allFilters = generateAllSystemUserFilters();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renderItem = (user: SystemUserDTO, _globalIndex: number, _localIndex?: number) => (
    <SystemUserListItem user={user} currentUserId={currentUserId} />
  );

  return (
    <ui.ClientFilterableList
      items={users}
      filters={allFilters}
      searchComponent={(searchTerm, setSearchTerm) => (
        <SystemUserClientSearch searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      )}
      filterBar={(resolvedUsers, activeFilters, setActiveFilters, filterDefinitions) => (
        <ui.ClientFilterBar
          items={transformSystemUsersForFilterBar(resolvedUsers)}
          filters={filterDefinitions}
          activeFilters={activeFilters}
          setActiveFilters={setActiveFilters}
          customCountFunction={(items, filter) => {
            // Use existing filter functions for complex cases
            const filterFunction = systemUserFilterFunctions[filter.key];
            if (filterFunction) {
              return items.filter((user) => filterFunction(user, filter.value)).length;
            }
            // Return undefined to let ClientFilterBar use default logic
            return undefined;
          }}
        />
      )}
      filterItems={(userList, searchTerm, activeFilters) => {
        return filterSystemUsersWithSearch(userList, searchTerm, activeFilters, allFilters);
      }}
      renderItem={renderItem}
      getItemKey={(user) => user.id}
      emptyMessage="No users found."
      className="space-y-4"
    />
  );
}
