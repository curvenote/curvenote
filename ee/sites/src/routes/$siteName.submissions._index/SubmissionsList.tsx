import type { SubmissionsIndexItem } from './types.js';
import { SubmissionsListItem } from './SubmissionsListItem.js';

interface SubmissionsListProps {
  siteName: string;
  items: SubmissionsIndexItem[];
  showCollectionChip?: boolean;
  showKindChip?: boolean;
}

export function SubmissionsList({
  siteName,
  items,
  showCollectionChip,
  showKindChip,
}: SubmissionsListProps) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">No submissions found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl">
      <div className="overflow-hidden rounded-sm border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        {items.map((item) => (
          <SubmissionsListItem
            key={item.id}
            siteName={siteName}
            item={item}
            showCollectionChip={showCollectionChip}
            showKindChip={showKindChip}
          />
        ))}
      </div>
    </div>
  );
}
