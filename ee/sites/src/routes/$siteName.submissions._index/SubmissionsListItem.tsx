import { Link } from 'react-router';
import { summarizeAuthors, ui } from '@curvenote/scms-core';
import { CategoryTagBadge } from './CategoryTagBadge.js';
import {
  Collection,
  HasPublishedVersion,
  HasRetractedVersion,
  SubmissionKind,
} from '../../components/Chips.js';
import type { SubmissionsIndexItem } from './types.js';
import { DoiBadge } from './DoiBadge.js';
import { SubmissionListingDates } from './SubmissionListingDates.js';
import { SubmissionStatusBadge } from './SubmissionStatusBadge.js';
import { VersionTimelineHoverCard } from './VersionTimelineHoverCard.js';

const AUTHORS_MAX_DISPLAY = 5;

interface SubmissionsListItemProps {
  siteName: string;
  item: SubmissionsIndexItem;
  showCollectionChip?: boolean;
  showKindChip?: boolean;
  queuesEnabled?: boolean;
}

export function SubmissionsListItem({
  siteName,
  item,
  showCollectionChip,
  showKindChip,
  queuesEnabled = false,
}: SubmissionsListItemProps) {
  const authorSummary = summarizeAuthors(item.authors, { maxDisplay: AUTHORS_MAX_DISPLAY });
  const fullAuthorList = item.authors.map((author) => author.name).join(', ');

  return (
    <div className="border-b border-gray-200 px-5 py-4 last:border-b-0 dark:border-gray-700">
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <div className="flex min-w-0 grow flex-col gap-0">
          <Link
            to={`/app/sites/${siteName}/submissions/${item.id}`}
            className="text-base font-medium leading-snug text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {item.title || 'Untitled submission'}
          </Link>
          {authorSummary ? (
            <p
              className="text-sm font-light text-gray-600 dark:text-gray-400"
              title={fullAuthorList}
            >
              {authorSummary}
            </p>
          ) : (
            <p className="text-sm font-light italic text-gray-600 dark:text-gray-400">
              No authors listed
            </p>
          )}
          <div className="mt-1 flex flex-wrap gap-1">
            {showCollectionChip ? <Collection collection={item.collection} /> : null}
            {showKindChip ? (
              <SubmissionKind
                title={(item.kind.content.title ?? item.kind.name) as string}
                description={item.kind.content.title ?? item.kind.name}
              />
            ) : null}
            {item.publishedVersion ? (
              <VersionTimelineHoverCard siteName={siteName} submissionId={item.id}>
                <HasPublishedVersion date={item.publishedVersion.date_created} disableTooltip />
              </VersionTimelineHoverCard>
            ) : null}
            {!item.publishedVersion && item.retractedVersion ? (
              <VersionTimelineHoverCard siteName={siteName} submissionId={item.id}>
                <HasRetractedVersion date={item.retractedVersion.date_created} disableTooltip />
              </VersionTimelineHoverCard>
            ) : null}
            {item.versionTag ? (
              <VersionTimelineHoverCard siteName={siteName} submissionId={item.id}>
                <ui.VersionTagBadge tag={item.versionTag} disableTooltip />
              </VersionTimelineHoverCard>
            ) : null}
            {item.doi ? <DoiBadge doi={item.doi} /> : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:w-[200px] sm:items-center">
          {queuesEnabled && item.queue ? (
            <CategoryTagBadge tag={item.queue} staff={item.queueStaff} />
          ) : null}
          <VersionTimelineHoverCard siteName={siteName} submissionId={item.id} align="end">
            <SubmissionStatusBadge status={item.status} label={item.statusLabel} />
          </VersionTimelineHoverCard>
        </div>
      </div>
      <SubmissionListingDates
        datePublished={item.datePublished}
        dateFirstSubmitted={item.dateFirstSubmitted}
        dateLastUpdated={item.dateLastUpdated}
      />
    </div>
  );
}
