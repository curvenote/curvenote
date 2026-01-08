import { formatDistance } from 'date-fns';
import { Activity } from 'lucide-react';
import type { SubmissionDTO, SubmissionActivityDTO } from '@curvenote/common';
import type { ActivityType } from '@prisma/client';
import { SectionWithHeading, primitives, formatDate } from '@curvenote/scms-core';

const ACTIVITY_TYPES: Record<ActivityType, string> = {
  NEW_SUBMISSION: 'New submission',
  SUBMISSION_KIND_CHANGE: 'Submission kind changed',
  SUBMISSION_DATE_CHANGE: 'Submission publication date changed',
  SUBMISSION_VERSION_ADDED: 'New submission version',
  SUBMISSION_VERSION_STATUS_CHANGE: 'Submission version status changed',
  SUBMISSION_VERSION_TRANSITION_STARTED: 'Submission version transition started',
  NEW_WORK: 'New work',
  WORK_VERSION_ADDED: 'New work version',
  KIND_CREATED: 'New submission kind',
  KIND_DELETED: 'Submission kind deleted',
  KIND_UPDATED: 'Submission kind updated',
  SITE_CONTENT_UPDATED: 'Site landing content updated',
  COLLECTION_CREATED: 'New collection',
  COLLECTION_DELETED: 'Collection deleted',
  COLLECTION_UPDATED: 'Collection updated',
  FORM_CREATED: 'Form created',
  FORM_DELETED: 'Form deleted',
  FORM_UPDATED: 'Form updated',
  FORM_SUBMITTED: 'Form submitted',
  USER_ENABLED: 'User enabled',
  USER_DISABLED: 'User disabled',
  USER_APPROVED: 'User approved',
  USER_REJECTED: 'User rejected',
  ACCESS_GRANTED: 'Access granted',
  ACCESS_REVOKED: 'Access revoked',
  ROLE_CREATED: 'Role created',
  ROLE_UPDATED: 'Role updated',
  ROLE_DELETED: 'Role deleted',
  ROLE_ASSIGNED: 'Role assigned',
  ROLE_REMOVED: 'Role removed',
};

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
        <p className="font-medium">{ACTIVITY_TYPES[activity_type as ActivityType]}</p>
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
            <div className="flex flex-col items-center justify-center pr-2 select-none">
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
