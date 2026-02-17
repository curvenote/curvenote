import { formatDistance } from 'date-fns';
import { Activity } from 'lucide-react';
import type { SubmissionDTO, SubmissionActivityDTO } from '@curvenote/common';
import {
  SectionWithHeading,
  primitives,
  formatDate,
  getActivityTypeLabel,
} from '@curvenote/scms-core';

function ActivityItemBody({ activity }: { activity: SubmissionActivityDTO }) {
  const { activity_type, activity_by, status, kind, submission_version, date_published } = activity;

  let tagColor = 'before:bg-green-600';
  let additionalInfo = null;
  if (activity_type === 'SUBMISSION_KIND_CHANGE') {
    tagColor = 'before:bg-yellow-800';
    additionalInfo = <p>new kind: {kind}</p>;
  } else if (activity_type === 'SUBMISSION_DATE_CHANGE') {
    tagColor = 'before:bg-gray-200';
    additionalInfo = <p>new date: {date_published}</p>;
  } else if (activity_type === 'VERSION_STATUS_CHANGE') {
    if (status === 'ACCEPTED') tagColor = 'before:bg-green-600';
    else if (status === 'REJECTED' || status === 'REMOVED') tagColor = 'before:bg-red-600';
    else if (status === 'PENDING') tagColor = 'before:bg-yellow-600';
    additionalInfo = (
      <div>
        <primitives.Caption>new status: {status}</primitives.Caption>
        <primitives.Caption>
          version date:{' '}
          {submission_version ? formatDate(submission_version.date_created) : 'unknown'}
        </primitives.Caption>
      </div>
    );
  }

  return (
    <div
      className={`flex col-span-3 whitespace-nowrap before:block before:h-full before:w-1 before:rounded-full ${tagColor} before:content-['']`}
    >
      <div className="pl-2">
        <p className="font-medium">{getActivityTypeLabel(activity_type)}</p>
        {additionalInfo}
        <primitives.Caption>{activity_by.name}</primitives.Caption>
      </div>
    </div>
  );
}

export default function ActivityTable({ activities }: { activities: SubmissionActivityDTO[] }) {
  return (
    <div className="space-y-4">
      {activities.map((a) => (
        <div key={a.id}>
          <div className="flex h-full">
            <div className="flex flex-col justify-center items-center pr-2 select-none">
              <p className="font-semibold whitespace-pre-wrap">
                {formatDistance(new Date(a.date_created), new Date())} ago
              </p>
              <p className="text-xs font-light">
                {formatDate(a.date_created, 'HH:mm:ss MMM dd, y')}
              </p>
            </div>
            <ActivityItemBody activity={a} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActivityFeed({ submission }: { submission: SubmissionDTO }) {
  return (
    <SectionWithHeading heading="Activity Feed" icon={Activity}>
      <primitives.Card lift className="p-8">
        <ActivityTable activities={submission.activity} />
      </primitives.Card>
    </SectionWithHeading>
  );
}
