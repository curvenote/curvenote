import type { Route } from './+types/route';
import { withAppAdminContext } from '@curvenote/scms-server';
import {
  PageFrame,
  TrackEvent,
  TrackEventDescriptions,
  getExtensionAnalyticsEvents,
} from '@curvenote/scms-core';
import { AnalyticsEventList } from './components/AnalyticsEventList';
import type { AnalyticsEvent } from './components/AnalyticsEventListingHelpers';
import { extensions } from '../../../extensions/client';

export async function loader(args: Route.LoaderArgs) {
  await withAppAdminContext(args);
  // Convert base TrackEvent enum to array with descriptions
  const baseTrackEvents: AnalyticsEvent[] = Object.entries(TrackEvent).map(([key, value]) => ({
    key,
    value,
    description: TrackEventDescriptions[value as TrackEvent] || 'Analytics event',
    extensionName: 'Base System',
  }));

  // Get extension analytics events
  const extensionAnalyticsEvents = getExtensionAnalyticsEvents(extensions);

  // Combine all events into a single array
  const allEvents: AnalyticsEvent[] = [
    ...baseTrackEvents,
    ...extensionAnalyticsEvents.flatMap((extension) =>
      extension.events.map((event) => ({
        key: event.key,
        value: event.value,
        description: event.description,
        extensionName: extension.extensionName,
      })),
    ),
  ];

  return { allEvents };
}

export const meta: Route.MetaFunction = () => {
  return [
    { title: 'Analytics Events - System Administration' },
    { name: 'description', content: 'System analytics event types and descriptions' },
  ];
};

export default function AnalyticsEventsPage({ loaderData }: Route.ComponentProps) {
  const { allEvents } = loaderData;

  return (
    <PageFrame>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Analytics Events</h1>
          <p className="mt-2 text-muted-foreground">
            Overview of all analytics event types tracked in the system
          </p>
        </div>

        <AnalyticsEventList events={allEvents} />
      </div>
    </PageFrame>
  );
}
