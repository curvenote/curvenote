import type { SiteDTO } from '@curvenote/common';
import { Link } from 'react-router';
import { clientCheckSiteScopes, formatDate, formatToNow, primitives } from '@curvenote/scms-core';
import {
  Collection,
  HasPublishedVersion,
  HasRetractedVersion,
  SubmissionAge,
  SubmissionKind,
  Slug,
} from './Chips.js';
import type { AugmentedSubmissionsListWithPagination } from '../routes/$siteName.submissions._index/types.js';
import { SubmissionActionsArea } from './SubmissionActionsArea.js';

export function SubmissionListItem({
  site,
  scopes,
  item,
  to,
  showCollectionChip,
}: {
  site: SiteDTO;
  scopes: string[];
  item: AugmentedSubmissionsListWithPagination['items'][0];
  to: (to: string) => string;
  revalidate: () => void;
  showCollectionChip?: boolean;
}) {
  const canUpdateStatus = clientCheckSiteScopes(scopes, ['site:submissions:update'], site.name);

  return (
    <primitives.Card lift>
      <div className="relative">
        <div className="flex flex-col gap-6 md:gap-4 md:flex-row lg:p-2 dark:text-white">
          <div className="flex flex-col grow">
            <div className="pb-1 grow">
              <div className="text-2xl font-semibold">
                <Link to={to(item.id)} className="hover:underline">
                  {item.title}
                </Link>
              </div>
              <div className="text-sm font-light pointer-events-none">
                {item.authors.map((a) => a.name).join(', ')}
              </div>
              <div className="text-sm font-light pointer-events-none">
                Publication Date: {item.date_published ? formatDate(item.date_published) : 'n/a'}
              </div>
            </div>
            <div data-role="submission-info-bottom" className="flex flex-wrap gap-1 mt-4">
              {showCollectionChip && <Collection collection={item.collection} />}
              <SubmissionKind
                title={
                  typeof item.kind === 'string'
                    ? item.kind
                    : ((item.kind.content.title ?? item.kind.name) as string)
                }
                description={
                  typeof item.kind === 'string'
                    ? undefined
                    : (item.kind.content.title ?? item.kind.name)
                }
              />
              <Slug slug={item.slug} />
              {item.published_version && (
                <HasPublishedVersion date={item.published_version.date_created} />
              )}
              {!item.published_version && item.retracted_version && (
                <HasRetractedVersion date={item.retracted_version.date_created} />
              )}
              <div className="block md:hidden">
                <SubmissionAge date={item.date_created} />
              </div>
              <div
                className="text-xs font-light text-center inline-flex p-[2px] md:hidden"
                title={`last activity was by ${item.last_activity.by.name} ${formatToNow(
                  item.last_activity.date,
                  { addSuffix: true },
                )}`}
              >
                Activity {formatToNow(item.last_activity.date, { addSuffix: true })}
              </div>
            </div>
          </div>
          <div className="md:flex flex-col items-center justify-center gap-1 md:w-[200px] hidden shrink-0">
            <div className="md:mt-2">
              <SubmissionAge date={item.date_created} />
            </div>
            <div
              className="text-xs font-light text-center md:inline-flex p-[2px]"
              title={`last activity was by ${item.last_activity.by.name} ${formatToNow(
                item.last_activity.date,
                { addSuffix: true },
              )}`}
            >
              Activity {formatToNow(item.last_activity.date, { addSuffix: true })}
            </div>
          </div>
          <SubmissionActionsArea item={item} site={site} canUpdateStatus={canUpdateStatus} />
        </div>
      </div>
    </primitives.Card>
  );
}
