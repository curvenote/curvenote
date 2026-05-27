import { ListingMultiSelectChip } from './ListingMultiSelectChip.js';
import type { ToolbarCollectionOption } from './route.js';

interface SubmissionsCollectionFilterProps {
  collections: ToolbarCollectionOption[];
  className?: string;
}

export function SubmissionsCollectionFilter({
  collections,
  className,
}: SubmissionsCollectionFilterProps) {
  if (collections.length === 0) return null;
  return (
    <ListingMultiSelectChip
      paramKey="collectionIds"
      label="Collection"
      searchPlaceholder="Search collections..."
      noResultsLabel="No matching collections."
      options={collections.map(({ id, name }) => ({ id, name }))}
      className={className}
    />
  );
}
