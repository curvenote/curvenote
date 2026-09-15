import { Tag as TagIcon } from 'lucide-react';
import { Tag, TagOverflow } from '../../components/Chips.js';
import type { SubmissionsIndexItem } from './types.js';
import { listingTagOverflowTitle, splitListingTags } from './SubmissionListingTags.utils.js';

export function SubmissionListingTags({ tags }: { tags: SubmissionsIndexItem['tags'] }) {
  if (tags.length === 0) {
    return null;
  }

  const { visible, overflow } = splitListingTags(tags);
  const overflowTitle = listingTagOverflowTitle(overflow);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      <TagIcon className="size-3.5 text-gray-400 dark:text-gray-500" aria-hidden />
      {visible.map((tag) => (
        <Tag key={tag.id} label={tag.label} name={tag.name} />
      ))}
      {overflowTitle ? <TagOverflow count={overflow.length} title={overflowTitle} /> : null}
    </div>
  );
}
