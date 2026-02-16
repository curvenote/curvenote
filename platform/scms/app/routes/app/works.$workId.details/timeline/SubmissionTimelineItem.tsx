import { Globe, Send } from 'lucide-react';
import { TimelineItemPlain } from './TimelineItem';
import { DateWithPopover } from './DateWithPopover';
import type { WorkVersionWithSubmissionVersions } from '../../works.$workId/types';

type SubmissionVersionRow = WorkVersionWithSubmissionVersions['submissionVersions'][number];

type SubmissionTimelineItemProps = {
  submissionVersion: SubmissionVersionRow;
};

/**
 * Maps a submission version (with submission.site and submitted_by) to a plain timeline row.
 * "Published by {site}" for PUBLISHED; "Submitted to {site} by {user}" otherwise.
 */
export function SubmissionTimelineItem({ submissionVersion }: SubmissionTimelineItemProps) {
  const site = submissionVersion.submission?.site;
  const siteTitle = site?.title ?? site?.name ?? 'Unknown site';
  const submittedBy = submissionVersion.submitted_by;
  const submitterName = submittedBy?.display_name ?? 'Unknown';
  const isPublished = submissionVersion.status === 'PUBLISHED';
  const dateStr =
    (isPublished ? submissionVersion.date_published : null) ?? submissionVersion.date_created;

  const icon = isPublished ? <Globe aria-hidden /> : <Send aria-hidden />;

  const message = isPublished ? (
    <>Published by {siteTitle}</>
  ) : (
    <>
      Submitted to {siteTitle}
      {submitterName && submitterName !== 'Unknown' && <> by {submitterName}</>}
    </>
  );

  const date = <DateWithPopover date={dateStr} />;

  return <TimelineItemPlain icon={icon} message={message} date={date} />;
}
