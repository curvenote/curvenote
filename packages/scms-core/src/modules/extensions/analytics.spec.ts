// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import type { ClientExtension } from './types.js';
import {
  ExtensionChecksAnalyticsEventKey,
  buildCheckServiceIdToExtensionMap,
  collectUniqueExtensionAnalyticsEventNames,
  filterCheckServiceIdsWithExtensionAnalyticsEvent,
  groupCheckServiceIdsByExtensionAnalyticsEvent,
  resolveCheckServiceAnalyticsEventName,
} from './analytics.js';

function noopComponent() {
  return null;
}

function extensionWithChecks(
  id: string,
  serviceId: string,
  analyticsEvents?: Record<string, string>,
): ClientExtension {
  return {
    id,
    name: id,
    description: id,
    registerNavigation: () => [],
    getChecks: () => [
      {
        id: serviceId,
        name: serviceId,
        description: serviceId,
        sectionHeaderComponent: noopComponent,
        sectionActivityComponent: noopComponent,
      },
    ],
    ...(analyticsEvents
      ? {
          getAnalyticsEvents: () => ({
            events: analyticsEvents,
            descriptions: Object.fromEntries(
              Object.values(analyticsEvents).map((value) => [value, value]),
            ),
          }),
        }
      : {}),
  };
}

describe('extension checks analytics helpers', () => {
  const sharedEvents = {
    [ExtensionChecksAnalyticsEventKey.UPLOAD_OPTION_TOGGLED]: 'Checks Upload Option Toggled',
    [ExtensionChecksAnalyticsEventKey.UPLOAD_CONFIRMED]: 'Checks Upload Confirmed',
    [ExtensionChecksAnalyticsEventKey.PAGE_VIEWED]: 'Checks Page Viewed',
  };

  const extA = extensionWithChecks('ext-a', 'service-a', sharedEvents);
  const extB = extensionWithChecks('ext-b', 'service-b', sharedEvents);
  const extWithoutAnalytics = extensionWithChecks('ext-plain', 'plain-service');
  const serviceMap = buildCheckServiceIdToExtensionMap([
    extA,
    extB,
    extWithoutAnalytics,
  ]);

  it('maps check service ids to owning extensions', () => {
    expect(serviceMap.get('service-a')?.id).toBe('ext-a');
    expect(serviceMap.get('plain-service')?.id).toBe('ext-plain');
  });

  it('resolves analytics event names from extension catalogs', () => {
    expect(
      resolveCheckServiceAnalyticsEventName(
        serviceMap,
        'service-a',
        ExtensionChecksAnalyticsEventKey.UPLOAD_OPTION_TOGGLED,
      ),
    ).toBe('Checks Upload Option Toggled');
    expect(
      resolveCheckServiceAnalyticsEventName(serviceMap, 'plain-service', 'CHECKS_PAGE_VIEWED'),
    ).toBeUndefined();
  });

  it('filters check services that register an analytics event key', () => {
    expect(
      filterCheckServiceIdsWithExtensionAnalyticsEvent(
        ['service-a', 'plain-service', 'service-b'],
        serviceMap,
        ExtensionChecksAnalyticsEventKey.UPLOAD_CONFIRMED,
      ),
    ).toEqual(['service-a', 'service-b']);
  });

  it('dedupes identical event names across extensions', () => {
    expect(
      collectUniqueExtensionAnalyticsEventNames(
        [extA, extB],
        ExtensionChecksAnalyticsEventKey.PAGE_VIEWED,
      ),
    ).toEqual(['Checks Page Viewed']);
  });

  it('groups check services by resolved event name', () => {
    const groups = groupCheckServiceIdsByExtensionAnalyticsEvent(
      ['service-a', 'service-b', 'plain-service'],
      serviceMap,
      ExtensionChecksAnalyticsEventKey.UPLOAD_CONFIRMED,
    );
    expect(groups.size).toBe(1);
    expect(groups.get('Checks Upload Confirmed')).toEqual(['service-a', 'service-b']);
  });
});
