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

/**
 * Stable keys extensions may expose via `getAnalyticsEvents().events` for platform-owned
 * check upload and checks-page instrumentation.
 */
export const ExtensionChecksAnalyticsEventKey = {
  UPLOAD_OPTION_TOGGLED: 'CHECKS_UPLOAD_OPTION_TOGGLED',
  UPLOAD_CONFIRMED: 'CHECKS_UPLOAD_CONFIRMED',
  PAGE_VIEWED: 'CHECKS_PAGE_VIEWED',
} as const;

export type ExtensionChecksAnalyticsEventKey =
  (typeof ExtensionChecksAnalyticsEventKey)[keyof typeof ExtensionChecksAnalyticsEventKey];

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

export function buildCheckServiceIdToExtensionMap(
  extensions: ClientExtension[],
): Map<string, ClientExtension> {
  const map = new Map<string, ClientExtension>();
  for (const extension of extensions) {
    if (!extension.getChecks) continue;
    for (const service of extension.getChecks()) {
      map.set(service.id, extension);
    }
  }
  return map;
}

export function resolveExtensionAnalyticsEventName(
  extension: ClientExtension,
  eventKey: string,
): string | undefined {
  const catalog = extension.getAnalyticsEvents?.();
  if (!catalog) return undefined;
  const value = catalog.events[eventKey];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function resolveCheckServiceAnalyticsEventName(
  serviceIdToExtension: Map<string, ClientExtension>,
  checkServiceId: string,
  eventKey: string,
): string | undefined {
  const extension = serviceIdToExtension.get(checkServiceId);
  if (!extension) return undefined;
  return resolveExtensionAnalyticsEventName(extension, eventKey);
}

export function filterCheckServiceIdsWithExtensionAnalyticsEvent(
  checkServiceIds: string[],
  serviceIdToExtension: Map<string, ClientExtension>,
  eventKey: string,
): string[] {
  return checkServiceIds.filter(
    (checkServiceId) =>
      resolveCheckServiceAnalyticsEventName(serviceIdToExtension, checkServiceId, eventKey) !=
      null,
  );
}

export function collectUniqueExtensionAnalyticsEventNames(
  extensions: ClientExtension[],
  eventKey: string,
): string[] {
  const names = new Set<string>();
  for (const extension of extensions) {
    const eventName = resolveExtensionAnalyticsEventName(extension, eventKey);
    if (eventName) names.add(eventName);
  }
  return [...names];
}

/** Group check service ids by the resolved Segment event name for a catalog key. */
export function groupCheckServiceIdsByExtensionAnalyticsEvent(
  checkServiceIds: string[],
  serviceIdToExtension: Map<string, ClientExtension>,
  eventKey: string,
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const checkServiceId of checkServiceIds) {
    const eventName = resolveCheckServiceAnalyticsEventName(
      serviceIdToExtension,
      checkServiceId,
      eventKey,
    );
    if (!eventName) continue;
    const existing = groups.get(eventName) ?? [];
    existing.push(checkServiceId);
    groups.set(eventName, existing);
  }
  return groups;
}
