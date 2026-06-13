import { Link } from 'react-router';
import { summarizeAuthors, ui, VersionTimelineHoverCard } from '@curvenote/scms-core';
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
import { submissionVersionsTimelineUrl } from '../../submissionVersionsTimelineUrl.js';

const AUTHORS_MAX_DISPLAY = 5;

interface SubmissionsListItemProps {
  siteName: string;
  item: SubmissionsIndexItem;
  showCollectionChip?: boolean;
  showKindChip?: boolean;
}

export function SubmissionsListItem({
  siteName,
  item,
  showCollectionChip,
  showKindChip,
}: SubmissionsListItemProps) {
  const authorSummary = summarizeAuthors(item.authors, { maxDisplay: AUTHORS_MAX_DISPLAY });
  const fullAuthorList = item.authors.map((author) => author.name).join(', ');
  const versionsUrl = submissionVersionsTimelineUrl(siteName, item.id);

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
              <VersionTimelineHoverCard versionsUrl={versionsUrl}>
                <HasPublishedVersion date={item.publishedVersion.date_created} disableTooltip />
              </VersionTimelineHoverCard>
            ) : null}
            {!item.publishedVersion && item.retractedVersion ? (
              <VersionTimelineHoverCard versionsUrl={versionsUrl}>
                <HasRetractedVersion date={item.retractedVersion.date_created} disableTooltip />
              </VersionTimelineHoverCard>
            ) : null}
            {item.versionTag ? (
              <VersionTimelineHoverCard versionsUrl={versionsUrl}>
                <ui.VersionTagBadge tag={item.versionTag} disableTooltip />
              </VersionTimelineHoverCard>
            ) : null}
            {item.doi ? <DoiBadge doi={item.doi} /> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-start sm:w-[200px] sm:justify-center">
          <VersionTimelineHoverCard versionsUrl={versionsUrl} align="end">
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
