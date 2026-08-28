// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, test, expect } from 'vitest';
import {
  toTagName,
  isValidTagName,
  isValidTagLabel,
  TAG_LABEL_MAX_LENGTH,
  TAG_NAME_MAX_LENGTH,
  TAG_NAME_MIN_LENGTH,
} from './tagName.js';

describe('toTagName', () => {
  test.each([
    ['Blog Post', 'blog-post'],
    ['  Editors   Pick  ', 'editors-pick'],
    ['Café Society', 'cafe-society'],
    ['R&D / Notes', 'r-d-notes'],
    ['snake_case_ok', 'snake_case_ok'],
    ['--Leading and trailing--', 'leading-and-trailing'],
    ['a___b', 'a-b'],
    ['mixed -_- separators', 'mixed-separators'],
    ['', ''],
  ])('%s becomes %s', (label, expected) => {
    expect(toTagName(label)).toBe(expected);
  });
});

describe('isValidTagName', () => {
  test('accepts a derived name of at least the minimum length', () => {
    expect(TAG_NAME_MIN_LENGTH).toBe(3);
    expect(isValidTagName('blog-post')).toBe(true);
    expect(isValidTagName('abc')).toBe(true);
  });

  test.each(['ab', '', '-abc', 'Blog Post', 'blog.post'])('rejects %s', (name) => {
    expect(isValidTagName(name)).toBe(false);
  });

  test('rejects a name over the maximum length', () => {
    expect(isValidTagName('a'.repeat(TAG_NAME_MAX_LENGTH))).toBe(true);
    expect(isValidTagName('a'.repeat(TAG_NAME_MAX_LENGTH + 1))).toBe(false);
  });
});

describe('isValidTagLabel', () => {
  test('accepts a label up to the maximum length', () => {
    expect(isValidTagLabel('Blog Post')).toBe(true);
    expect(isValidTagLabel('a'.repeat(TAG_LABEL_MAX_LENGTH))).toBe(true);
  });

  test.each([
    ['', 'empty'],
    ['a'.repeat(TAG_LABEL_MAX_LENGTH + 1), 'too long'],
  ])('rejects a %s label (%s)', (label) => {
    expect(isValidTagLabel(label)).toBe(false);
  });
});
