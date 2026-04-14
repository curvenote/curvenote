import { createContext, useContext, useState, type ReactNode } from 'react';
import { ui } from '@curvenote/scms-core';

type TimelineActivitiesVisibilityValue = {
  showActivities: boolean;
  setShowActivities: (value: boolean) => void;
};

const TimelineActivitiesVisibilityContext = createContext<TimelineActivitiesVisibilityValue | null>(
  null,
);

/**
 * Holds whether work-activity rows are visible on the version timeline.
 * Activities are hidden by default; use {@link TimelineActivitiesToggle} in the timeline header.
 */
export function TimelineActivitiesVisibilityProvider({ children }: { children: ReactNode }) {
  const [showActivities, setShowActivities] = useState(false);
  return (
    <TimelineActivitiesVisibilityContext.Provider value={{ showActivities, setShowActivities }}>
      {children}
    </TimelineActivitiesVisibilityContext.Provider>
  );
}

export function useTimelineActivitiesVisibility() {
  const ctx = useContext(TimelineActivitiesVisibilityContext);
  if (!ctx) {
    throw new Error(
      'useTimelineActivitiesVisibility must be used within TimelineActivitiesVisibilityProvider',
    );
  }
  return ctx;
}

export function TimelineActivitiesToggle() {
  const { showActivities, setShowActivities } = useTimelineActivitiesVisibility();
  return (
    <ui.Button
      type="button"
      variant="link"
      className="h-auto px-0 text-sm font-normal"
      onClick={() => setShowActivities(!showActivities)}
    >
      {showActivities ? 'Hide Activities' : 'Show Activities'}
    </ui.Button>
  );
}
