import type { SiteDTO } from '@curvenote/common';
import { SubmissionListItem } from './SubmissionListItem.js';
import type { AugmentedSubmissionsListWithPagination } from '../routes/$siteName.submissions._index/types.js';

export function SubmissionList({
  site,
  scopes,
  items,
  to,
  showCollectionChip,
  revalidate,
}: {
  site: SiteDTO;
  scopes: string[];
  items: AugmentedSubmissionsListWithPagination['items'];
  to: (id: string) => string;
  showCollectionChip?: boolean;
  revalidate: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:gap-2">
      {items.map((item) => (
        <SubmissionListItem
          key={item.id}
          site={site}
          scopes={scopes}
          item={item}
          to={to}
          revalidate={revalidate}
          showCollectionChip={showCollectionChip}
        />
      ))}
    </div>
  );
}
