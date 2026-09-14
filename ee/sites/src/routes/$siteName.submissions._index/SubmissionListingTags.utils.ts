export const LISTING_TAG_VISIBLE_MAX = 3;

export function splitListingTags<T>(tags: T[]): { visible: T[]; overflow: T[] } {
  return {
    visible: tags.slice(0, LISTING_TAG_VISIBLE_MAX),
    overflow: tags.slice(LISTING_TAG_VISIBLE_MAX),
  };
}

export function listingTagOverflowTitle(overflow: { label: string }[]): string | undefined {
  if (overflow.length === 0) {
    return undefined;
  }
  return overflow.map((tag) => tag.label).join(', ');
}
