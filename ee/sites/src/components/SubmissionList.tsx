import type { SubmissionListingSiteContext } from '../routes/$siteName.submissions._index/site-context.format.server.js';
import { SubmissionListItem } from './SubmissionListItem.js';
import type { AugmentedSubmissionListingItem } from '../routes/$siteName.submissions._index/types.js';

// TODO: Remove this legacy listing component tree (SubmissionList,
// SubmissionListItem, SubmissionActionsArea) if it remains unused after the
// upcoming submission details and inbox changes settle.
export function SubmissionList({
  site,
  scopes,
  items,
  to,
  showCollectionChip,
  revalidate,
}: {
  site: SubmissionListingSiteContext;
  scopes: string[];
  items: AugmentedSubmissionListingItem[];
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
