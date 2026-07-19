import type { ReactNode } from 'react';
import { Activity } from 'lucide-react';
import { getActivityTypeLabel } from '../../utils/activityLabels.js';
import { DateWithPopover } from './DateWithPopover.js';
import { TimelineItemExpandable, TimelineItemPlain } from './TimelineItem.js';

export type TimelineActivityRow = {
  id: string;
  date_created: string;
  date_modified?: string;
  activity_type: string;
  data?: Record<string, unknown> | null;
  transition?: Record<string, unknown> | null;
  activity_by?: {
    display_name?: string | null;
    name?: string | null;
  } | null;
};

type ActivityTimelineItemProps = {
  activity: TimelineActivityRow;
  /** Optional data override for `getActivityTypeLabel`, useful when route formatting derives display metadata. */
  labelData?: Record<string, unknown> | null;
  details?: ReactNode;
};

/**
 * One activity row in a timeline: icon, label, actor, relative date, and optional expandable details.
 */
export function ActivityTimelineItem({ activity, labelData, details }: ActivityTimelineItemProps) {
  const by =
    activity.activity_by?.display_name?.trim() || activity.activity_by?.name?.trim() || 'Someone';
  const label = getActivityTypeLabel(activity.activity_type, {
    data: labelData ?? activity.data,
    transition: activity.transition,
  });
  const message = (
    <>
      {label}
      {by && by !== 'Someone' && <> by {by}</>}
    </>
  );
  const date = (
    <DateWithPopover
      date={activity.date_created}
      dateCreated={activity.date_created}
      dateModified={activity.date_modified ?? activity.date_created}
    />
  );

  if (details != null) {
    return (
      <TimelineItemExpandable
        icon={<Activity className="w-4 h-4" aria-hidden />}
        message={message}
        date={date}
        className="text-muted-foreground"
      >
        {details}
      </TimelineItemExpandable>
    );
  }

  return (
    <TimelineItemPlain
      muted
      icon={<Activity className="w-4 h-4" aria-hidden />}
      message={message}
      date={date}
    />
  );
}
