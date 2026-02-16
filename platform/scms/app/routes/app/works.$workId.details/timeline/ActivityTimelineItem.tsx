import { Activity } from 'lucide-react';
import { TimelineItemPlain } from './TimelineItem';
import { DateWithPopover } from './DateWithPopover';
import { getActivityTypeLabel } from '@curvenote/scms-core';
import type { WorkActivityRow } from '../../works.$workId/db.server';

type ActivityTimelineItemProps = {
  activity: WorkActivityRow;
};

/**
 * One activity in the work version timeline: icon, message (type + by whom), date.
 */
export function ActivityTimelineItem({ activity }: ActivityTimelineItemProps) {
  const by = activity.activity_by?.display_name?.trim() ?? 'Someone';
  const label = getActivityTypeLabel(activity.activity_type, {
    transition: activity.transition,
  });
  const message = (
    <>
      {label}
      {by && by !== 'Someone' && <> by {by}</>}
    </>
  );
  const date = <DateWithPopover date={activity.date_created} />;

  return (
    <TimelineItemPlain
      icon={<Activity className="w-4 h-4" aria-hidden />}
      message={message}
      date={date}
    />
  );
}
