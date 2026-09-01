// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { listingMultiSelectEmptyCopy } from './ListingMultiSelectChip.utils.js';

describe('listingMultiSelectEmptyCopy', () => {
  it('uses the catalog-empty copy when there are no options', () => {
    expect(
      listingMultiSelectEmptyCopy({
        optionsLength: 0,
        noResultsLabel: 'No matching tags.',
        emptyCatalogLabel: 'No tags yet',
      }),
    ).toBe('No tags yet');
  });

  it('uses the search-miss copy when options exist', () => {
    expect(
      listingMultiSelectEmptyCopy({
        optionsLength: 3,
        noResultsLabel: 'No matching tags.',
        emptyCatalogLabel: 'No tags yet',
      }),
    ).toBe('No matching tags.');
  });

  it('falls back to the search-miss copy when the catalog-empty copy is omitted', () => {
    expect(
      listingMultiSelectEmptyCopy({
        optionsLength: 0,
        noResultsLabel: 'No matching kinds.',
      }),
    ).toBe('No matching kinds.');
  });
});
