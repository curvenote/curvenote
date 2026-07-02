import type {
  ClientExtension,
  ExtensionAnalyticsEvents,
  ExtensionTask,
} from '@curvenote/scms-core';
import { BioRxivTrackEvent, BioRxivTrackEventDescriptions } from './analytics.js';
import { BioRxivTaskCard } from './BioRxivTaskCard.js';

export const id = 'biorxiv';
export const name = 'bioRxiv';
export const description = 'bioRxiv preprint submission task';

export function getTasks(): ExtensionTask[] {
  return [
    {
      id: 'biorxiv-submission',
      name: 'Submit to bioRxiv',
      description: 'Visit bioRxiv to learn about preprint submissions and start the process.',
      component: BioRxivTaskCard,
      category: 'publish',
    },
  ];
}

export function getAnalyticsEvents(): ExtensionAnalyticsEvents {
  return {
    events: BioRxivTrackEvent,
    descriptions: BioRxivTrackEventDescriptions,
  };
}

export const extension: ClientExtension = {
  id,
  name,
  description,
  getTasks,
  getAnalyticsEvents,
  registerNavigation: () => [],
};
