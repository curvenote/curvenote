/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect } from 'vitest';
import { formatTagDTO } from './format.server.js';

describe('formatTagDTO', () => {
  test('returns id, name and label only', () => {
    const dto = formatTagDTO({
      id: 'tag1',
      name: 'blog-post',
      label: 'Blog Post',
      site_id: 'site1',
      date_created: '2026-08-27T00:00:00.000Z',
    } as never);

    expect(dto).toEqual({ id: 'tag1', name: 'blog-post', label: 'Blog Post' });
  });
});
