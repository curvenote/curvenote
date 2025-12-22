import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { usePingEvent } from '../utils/analytics.js';
import { TrackEvent } from '../backend/services/analytics/events.js';

/**
 * Hook to track page navigation using the pingEvent pattern.
 * Only sends the navigate event once per page load to avoid duplicate events
 * from polling or reloading.
 */
export function useNavigationTracking() {
  const location = useLocation();
  const pingEvent = usePingEvent();
  const previousLocationRef = useRef<string>('');

  useEffect(() => {
    const currentLocation = `${location.pathname}${location.search}${location.hash}`;

    // Only track if the location has actually changed
    if (currentLocation !== previousLocationRef.current) {
      previousLocationRef.current = currentLocation;

      pingEvent(TrackEvent.NAVIGATE, {
        path: location.pathname,
        search: location.search,
        hash: location.hash,
      });
    }
  }, [location, pingEvent]);
}
