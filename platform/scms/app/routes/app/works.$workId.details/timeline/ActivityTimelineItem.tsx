import { Activity } from 'lucide-react';
import { TimelineItemPlain } from './TimelineItem';
import { DateWithPopover } from './DateWithPopover';
import type { WorkActivityRow } from '../../works.$workId/db.server';

type ActivityTimelineItemProps = {
  activity: WorkActivityRow;
};

/** Human-readable label for activity type in the timeline. */
function activityTypeLabel(activityType: string): string {
  const labels: Record<string, string> = {
    WORK_VERSION_ADDED: 'Version added',
    SUBMISSION_VERSION_ADDED: 'Submission version added',
    SUBMISSION_VERSION_STATUS_CHANGE: 'Status changed',
    SUBMISSION_VERSION_TRANSITION_STARTED: 'Transition started',
    NEW_SUBMISSION: 'New submission',
    SUBMISSION_KIND_CHANGE: 'Kind changed',
    SUBMISSION_DATE_CHANGE: 'Date changed',
    NEW_WORK: 'New work',
  };
  return labels[activityType] ?? activityType.replace(/_/g, ' ').toLowerCase();
}

/**
 * One activity in the work version timeline: icon, message (type + by whom), date.
 */
export function ActivityTimelineItem({ activity }: ActivityTimelineItemProps) {
  const by = activity.activity_by?.display_name?.trim() ?? 'Someone';
  const label = activityTypeLabel(activity.activity_type);
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
