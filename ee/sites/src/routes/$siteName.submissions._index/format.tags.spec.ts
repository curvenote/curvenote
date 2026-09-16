/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect } from 'vitest';
import { formatIndexItemTags } from './format.server.js';

describe('formatIndexItemTags', () => {
  test('maps the join rows to TagDTOs', () => {
    expect(
      formatIndexItemTags([{ tag: { id: 'tag1', name: 'blog-post', label: 'Blog Post' } }]),
    ).toEqual([{ id: 'tag1', name: 'blog-post', label: 'Blog Post' }]);
  });

  test('handles a row with no tags', () => {
    expect(formatIndexItemTags([])).toEqual([]);
  });
});
