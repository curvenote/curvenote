import { describe, test, expect } from 'vitest';
import { toTagName, isValidTagName, TAG_NAME_MIN_LENGTH } from './tagName.js';

describe('toTagName', () => {
  test.each([
    ['Blog Post', 'blog-post'],
    ['  Editors   Pick  ', 'editors-pick'],
    ['Café Society', 'cafe-society'],
    ['R&D / Notes', 'r-d-notes'],
    ['snake_case_ok', 'snake_case_ok'],
    ['--Leading and trailing--', 'leading-and-trailing'],
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
});
