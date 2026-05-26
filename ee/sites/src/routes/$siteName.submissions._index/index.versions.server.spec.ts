// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { firstVersionTag } from './index.versions.server.js';

describe('firstVersionTag', () => {
  it('returns the first submission version tag', () => {
    expect(firstVersionTag({ tags: ['v2'] })).toBe('v2');
  });

  it('returns undefined when the submission version has no tags', () => {
    expect(firstVersionTag({ tags: [] })).toBeUndefined();
  });
});
