/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect } from 'vitest';
import { formatSubmissionDetailTags } from './detail.format.server.js';

describe('formatSubmissionDetailTags', () => {
  test('maps the join rows to TagDTOs', () => {
    expect(
      formatSubmissionDetailTags([
        { tag: { id: 'tag1', name: 'blog-post', label: 'Blog Post' } },
        { tag: { id: 'tag2', name: 'editors-pick', label: 'Editors Pick' } },
      ]),
    ).toEqual([
      { id: 'tag1', name: 'blog-post', label: 'Blog Post' },
      { id: 'tag2', name: 'editors-pick', label: 'Editors Pick' },
    ]);
  });

  test('handles a submission with no tags', () => {
    expect(formatSubmissionDetailTags([])).toEqual([]);
  });
});
