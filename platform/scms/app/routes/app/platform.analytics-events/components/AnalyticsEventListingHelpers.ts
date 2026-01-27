import type { ui } from '@curvenote/scms-core';

export interface AnalyticsEvent {
  key: string;
  value: string;
  description: string;
  extensionName?: string;
}

export function filterEventsWithSearch(
  events: AnalyticsEvent[],
  searchTerm: string,
  activeFilters: Record<string, any>,
): AnalyticsEvent[] {
  let filteredEvents = [...events];

  // Apply search filter
  if (searchTerm.trim()) {
    const searchLower = searchTerm.toLowerCase();
    filteredEvents = filteredEvents.filter((event) => {
      return (
        event.value.toLowerCase().includes(searchLower) ||
        event.description.toLowerCase().includes(searchLower) ||
        event.key.toLowerCase().includes(searchLower) ||
        (event.extensionName && event.extensionName.toLowerCase().includes(searchLower))
      );
    });
  }

  // Apply extension filters
  // Look for active extension filters (format: "extension_ExtensionName")
  const activeExtensionFilters = Object.entries(activeFilters)
    .filter(([key, value]) => key.startsWith('extension_') && value === true)
    .map(([key]) => key.replace('extension_', ''));

  if (activeExtensionFilters.length > 0) {
    filteredEvents = filteredEvents.filter((event) => {
      const eventExtensionName = event.extensionName || 'Base System';
      return activeExtensionFilters.includes(eventExtensionName);
    });
  }

  return filteredEvents;
}

export function transformEventsForFilterBar(events: AnalyticsEvent[]) {
  return events.map((event) => ({
    ...event,
    // Add any additional properties needed for filtering
  }));
}

export function generateAllEventFilters(events: AnalyticsEvent[]): ui.FilterDefinition[] {
  // Extract unique extension names from the events
  const extensionNames = Array.from(
    new Set(events.map((event) => event.extensionName || 'Base System')),
  ).sort();

  // Create individual FilterDefinition objects for each extension with counts
  return extensionNames.map((name) => {
    const count = events.filter((event) => (event.extensionName || 'Base System') === name).length;
    return {
      key: 'extension',
      value: name,
      label: name,
      count,
    };
  });
}
