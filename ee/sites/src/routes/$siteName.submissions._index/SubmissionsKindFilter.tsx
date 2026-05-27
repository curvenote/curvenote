import { ListingMultiSelectChip, type ListingMultiSelectOption } from './ListingMultiSelectChip.js';

interface SubmissionsKindFilterProps {
  kinds: ListingMultiSelectOption[];
  className?: string;
}

export function SubmissionsKindFilter({ kinds, className }: SubmissionsKindFilterProps) {
  if (kinds.length === 0) return null;
  return (
    <ListingMultiSelectChip
      paramKey="kindIds"
      label="Kind"
      searchPlaceholder="Search kinds..."
      noResultsLabel="No matching kinds."
      options={kinds}
      className={className}
    />
  );
}
