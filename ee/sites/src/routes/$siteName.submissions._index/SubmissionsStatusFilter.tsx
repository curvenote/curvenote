import { ListingMultiSelectChip } from './ListingMultiSelectChip.js';
import { LISTING_STATUS_OPTIONS } from './listingParams.js';

interface SubmissionsStatusFilterProps {
  className?: string;
}

/**
 * Status multi-select chip.
 *
 * Filters by the *newest* SubmissionVersion's status — matching what the
 * listing card displays. The chip is always rendered, even on sites where
 * only one status is in active use, so the toolbar layout stays predictable.
 *
 * Renders with `searchable={false}` because the curated set is small (five
 * options) and fits in the popover without needing a type-to-filter input.
 *
 * Backed today by a correlated subquery in `buildListingRawSqlWhere` (forces
 * the raw SQL path). The denormalisation slice will introduce
 * `Submission.active_status`, after which the predicate moves to
 * `buildListingPrismaWhere` and the fast path takes over — no change here.
 */
export function SubmissionsStatusFilter({ className }: SubmissionsStatusFilterProps) {
  return (
    <ListingMultiSelectChip
      paramKey="statuses"
      label="Status"
      defaultValueLabel="All"
      searchable={false}
      options={[...LISTING_STATUS_OPTIONS]}
      className={className}
    />
  );
}
