import { Link } from 'react-router';
import { Activity, ShieldCheck } from 'lucide-react';
import { TimelineItemPlain } from './TimelineItem';
import { DateWithPopover } from './DateWithPopover';
import { getActivityTypeLabel } from '@curvenote/scms-core';
import type { WorkActivityRow } from '../../works.$workId/db.server';

type ActivityTimelineItemProps = {
  activity: WorkActivityRow;
  /** When set, check activities (e.g. CHECK_STARTED) link to this work's integrity page. */
  workIntegrityHref?: string | null;
};

/**
 * One activity in the work version timeline: icon, message (type + by whom), date.
 * Check activities are clickable and link to the work-integrity route when workIntegrityHref is provided.
 */
export function ActivityTimelineItem({ activity, workIntegrityHref }: ActivityTimelineItemProps) {
  const by = activity.activity_by?.display_name?.trim() ?? 'Someone';
  const label = getActivityTypeLabel(activity.activity_type, {
    data: activity.data,
    transition: activity.transition,
  });
  const message = (
    <>
      {label}
      {by && by !== 'Someone' && <> by {by}</>}
    </>
  );
  const date = <DateWithPopover date={activity.date_created} />;

  const isCheckActivity = activity.activity_type === 'CHECK_STARTED';
  const icon = isCheckActivity ? (
    <ShieldCheck className="w-4 h-4" aria-hidden />
  ) : (
    <Activity className="w-4 h-4" aria-hidden />
  );
  const item = (
    <TimelineItemPlain
      icon={icon}
      message={message}
      date={date}
      className={isCheckActivity && workIntegrityHref ? 'cursor-pointer' : undefined}
    />
  );

  if (isCheckActivity && workIntegrityHref) {
    return (
      <Link to={workIntegrityHref} className="block">
        {item}
      </Link>
    );
  }
  return item;
}
