/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect } from 'vitest';
import { filterTagOptions, getCreateTagOption } from './TagPicker.utils.js';

const catalog = [
  { id: 'tag1', name: 'blog-post', label: 'Blog Post' },
  { id: 'tag2', name: 'editors-pick', label: 'Editors Pick' },
];

describe('filterTagOptions', () => {
  test('returns the whole catalog for an empty query', () => {
    expect(filterTagOptions(catalog, '')).toEqual(catalog);
  });

  test('matches on label, case insensitively', () => {
    expect(filterTagOptions(catalog, 'blog')).toEqual([catalog[0]]);
  });

  test('matches on name', () => {
    expect(filterTagOptions(catalog, 'editors-pick')).toEqual([catalog[1]]);
  });
});

describe('getCreateTagOption', () => {
  test('offers a create option for a new label', () => {
    expect(getCreateTagOption(catalog, 'Case Study')).toEqual({
      label: 'Case Study',
      name: 'case-study',
    });
  });

  test('offers nothing when the derived name already exists', () => {
    expect(getCreateTagOption(catalog, 'blog post')).toBeUndefined();
  });

  test('offers nothing for a name that is too short', () => {
    expect(getCreateTagOption(catalog, 'ab')).toBeUndefined();
  });

  test('offers nothing for an empty query', () => {
    expect(getCreateTagOption(catalog, '   ')).toBeUndefined();
  });
});
