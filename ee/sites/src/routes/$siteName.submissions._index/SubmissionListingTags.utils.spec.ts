/* eslint-disable import/no-extraneous-dependencies */
import { describe, expect, test } from 'vitest';
import {
  LISTING_TAG_VISIBLE_MAX,
  listingTagOverflowTitle,
  splitListingTags,
} from './SubmissionListingTags.utils.js';

const tags = [
  { id: '1', name: 'one', label: 'One' },
  { id: '2', name: 'two', label: 'Two' },
  { id: '3', name: 'three', label: 'Three' },
  { id: '4', name: 'four', label: 'Four' },
];

describe('splitListingTags', () => {
  test('returns no overflow at the visible max', () => {
    expect(splitListingTags(tags.slice(0, LISTING_TAG_VISIBLE_MAX))).toEqual({
      visible: tags.slice(0, LISTING_TAG_VISIBLE_MAX),
      overflow: [],
    });
  });

  test('keeps the first three visible and the rest in overflow', () => {
    expect(splitListingTags(tags)).toEqual({
      visible: tags.slice(0, 3),
      overflow: [tags[3]],
    });
  });

  test('returns empty visible and overflow for no tags', () => {
    expect(splitListingTags([])).toEqual({ visible: [], overflow: [] });
  });
});

describe('listingTagOverflowTitle', () => {
  test('joins overflow labels', () => {
    expect(listingTagOverflowTitle([{ label: 'Four' }, { label: 'Five' }])).toBe('Four, Five');
  });

  test('returns undefined when there is no overflow', () => {
    expect(listingTagOverflowTitle([])).toBeUndefined();
  });
});
