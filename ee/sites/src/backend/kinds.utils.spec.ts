// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { kindTitle } from './kinds.utils.js';

describe('kindTitle', () => {
  it('prefers the title in the kind content', () => {
    expect(kindTitle({ name: 'Article', content: { title: 'Research Article' } })).toBe(
      'Research Article',
    );
  });

  it.each([[{}], [null], [{ title: '  ' }], [{ title: 42 }]])(
    'falls back to the name when the content is %j',
    (content) => {
      expect(kindTitle({ name: 'Article', content })).toBe('Article');
    },
  );
});
