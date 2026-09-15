import { ListingMultiSelectChip, type ListingMultiSelectOption } from './ListingMultiSelectChip.js';

interface SubmissionsTagFilterProps {
  tags: ListingMultiSelectOption[];
  className?: string;
}

/**
 * Editorial-tag multi-select chip.
 *
 * Always rendered, including when the catalog is empty or has a single tag.
 * Unlike Kind, a tag filter is useful even on a one-tag site because not
 * every submission has it. Empty catalog copy is handled by the shared chip
 * via `emptyCatalogLabel`.
 */
export function SubmissionsTagFilter({ tags, className }: SubmissionsTagFilterProps) {
  return (
    <ListingMultiSelectChip
      paramKey="tagIds"
      label="Tags"
      searchPlaceholder="Search tags..."
      noResultsLabel="No matching tags."
      emptyCatalogLabel="No tags yet"
      options={tags}
      className={className}
    />
  );
}
