import { ui } from '@curvenote/scms-core';
import { AnalyticsEventSearch } from './AnalyticsEventSearch';
import { AnalyticsEventListItem } from './AnalyticsEventListItem';
import {
  filterEventsWithSearch,
  transformEventsForFilterBar,
  generateAllEventFilters,
} from './AnalyticsEventListingHelpers';

interface AnalyticsEvent {
  key: string;
  value: string;
  description: string;
  extensionName?: string;
}

interface AnalyticsEventListProps {
  events: AnalyticsEvent[];
}

export function AnalyticsEventList({ events }: AnalyticsEventListProps) {
  // Generate filters for events based on the actual events data
  const allFilters = generateAllEventFilters(events);

  const renderItem = (event: AnalyticsEvent) => <AnalyticsEventListItem event={event} />;

  return (
    <div className="space-y-4">
      <ui.ClientFilterableList
        items={events}
        filters={allFilters}
        persist={true}
        searchComponent={(searchTerm, setSearchTerm) => (
          <AnalyticsEventSearch searchTerm={searchTerm} onSearchChange={setSearchTerm} />
        )}
        filterBar={(resolvedEvents, activeFilters, setActiveFilters, filterDefinitions) => (
          <ui.ClientFilterBar
            items={transformEventsForFilterBar(resolvedEvents)}
            filters={filterDefinitions}
            activeFilters={activeFilters}
            setActiveFilters={setActiveFilters}
            customCountFunction={(items, filter) => {
              // Calculate count for extension filters
              if (filter.key === 'extension') {
                return items.filter(
                  (event) => (event.extensionName || 'Base System') === filter.value,
                ).length;
              }
              // Return undefined to let ClientFilterBar use default logic for other filters
              return undefined;
            }}
          />
        )}
        filterItems={(eventList, searchTerm, activeFilters) => {
          return filterEventsWithSearch(eventList, searchTerm, activeFilters);
        }}
        renderItem={renderItem}
        getItemKey={(event) => `${event.extensionName || 'base'}-${event.key}`}
        emptyMessage="No events found."
        className=""
      />
    </div>
  );
}
