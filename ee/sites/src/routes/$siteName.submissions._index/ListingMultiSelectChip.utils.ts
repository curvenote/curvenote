export type ListingMultiSelectEmptyCopyInput = {
  optionsLength: number;
  noResultsLabel: string;
  emptyCatalogLabel?: string;
};

/**
 * Copy for the chip popover empty state.
 *
 * Catalog-empty (`optionsLength === 0`) and search-miss are different
 * product states and must not share one string when `emptyCatalogLabel` is set.
 */
export function listingMultiSelectEmptyCopy(input: ListingMultiSelectEmptyCopyInput): string {
  if (input.optionsLength === 0 && input.emptyCatalogLabel) {
    return input.emptyCatalogLabel;
  }
  return input.noResultsLabel;
}
