import { ui } from '@curvenote/scms-core';
import { WorkListItem } from './WorkListItem';
import { WorksClientSearch } from './WorksClientSearch';
import {
  filterWorks,
  getRoleLabel,
  sortWorksInGroup,
  getWorkGroupKey,
  generateSiteFilters,
  transformWorksForFilterBar,
} from './ClientListingHelpers';

import type { WorkWithRole } from './ClientListingHelpers';

export function WorkList({
  items,
  workflows,
}: {
  items: Promise<WorkWithRole[]>;
  workflows: Record<string, any>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renderItem = (work: WorkWithRole, _globalIndex: number, _localIndex?: number) => (
    <WorkListItem work={work} workflows={workflows} />
  );

  const renderGroup = (
    groupKey: string,
    groupItems: WorkWithRole[],
    renderItemFn: (item: WorkWithRole, globalIndex: number, localIndex: number) => React.ReactNode,
  ) => {
    // Sort items within the group by date created (newest first)
    const sortedItems = sortWorksInGroup(groupItems);

    return (
      <ui.GroupedItems
        groupKey={getRoleLabel(groupKey as any)}
        groupItems={sortedItems}
        globalStartIndex={0}
        renderItem={renderItemFn}
        getItemKey={(item) => item.id}
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        headerContent={(roleGroupKey, _count, _items) => (
          <div className="px-6 pt-6 pb-1 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-700 text-md dark:text-gray-300">{roleGroupKey}</h3>
          </div>
        )}
      />
    );
  };

  return (
    <ui.ClientFilterableList
      items={items}
      filters={[]} // Will be dynamically set based on resolved items
      searchComponent={(searchTerm, setSearchTerm) => (
        <WorksClientSearch searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      )}
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      filterBar={(resolvedItems, activeFilters, setActiveFilters, _filterDefinitions) => {
        // Generate site filters dynamically from the resolved items
        const siteFilters = generateSiteFilters(resolvedItems);

        // Only show filter bar if there are sites to filter by
        if (siteFilters.length === 0) {
          return null;
        }

        return (
          <ui.ClientFilterBar
            items={transformWorksForFilterBar(resolvedItems)}
            filters={siteFilters}
            activeFilters={activeFilters}
            setActiveFilters={setActiveFilters}
          />
        );
      }}
      filterItems={(works, searchTerm, activeFilters) => {
        // Generate filters dynamically for the filtering logic
        const siteFilters = generateSiteFilters(works);
        return filterWorks(works, searchTerm, activeFilters, siteFilters);
      }}
      groupBy={getWorkGroupKey}
      renderGroup={renderGroup}
      renderItem={renderItem}
      getItemKey={(work) => work.id}
      emptyMessage="No Works to show"
      persist={true}
    />
  );
}
