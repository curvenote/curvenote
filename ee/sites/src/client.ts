/**
 * Client-safe exports for the Sites extension.
 */

import type { ClientExtension, ExtensionAnalyticsEvents } from '@curvenote/scms-core';
import { SiteTrackEvent, SiteTrackEventDescriptions } from './analytics/events.js';
import { registerNavigation } from './navigation.js';
import { getIcons } from './icons.js';

export const id = 'sites';
export const name = 'Sites';
export const description = 'Site management UI';

function getAnalyticsEvents(): ExtensionAnalyticsEvents {
  return {
    events: SiteTrackEvent,
    descriptions: SiteTrackEventDescriptions,
  };
}

export const extension: ClientExtension = {
  id,
  name,
  description,
  getAnalyticsEvents,
  getIcons,
  registerNavigation,
} as const;
