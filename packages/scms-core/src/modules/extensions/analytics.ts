import type { ClientExtension } from './types.js';

export interface ExtensionAnalyticsData {
  extensionId: string;
  extensionName: string;
  events: Array<{
    key: string;
    value: string;
    description: string;
  }>;
}

export function getExtensionAnalyticsEvents(
  extensions: ClientExtension[],
): ExtensionAnalyticsData[] {
  return extensions
    .map((extension) => {
      const analyticsEvents = extension.getAnalyticsEvents?.();
      if (!analyticsEvents) {
        return null;
      }

      const events = Object.entries(analyticsEvents.events).map(([key, value]) => ({
        key,
        value,
        description: analyticsEvents.descriptions[value] || 'Analytics event',
      }));

      return {
        extensionId: extension.id,
        extensionName: extension.name,
        events,
      };
    })
    .filter((data): data is ExtensionAnalyticsData => data !== null);
}
