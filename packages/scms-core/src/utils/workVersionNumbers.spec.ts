// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  buildWorkVersionNumberByIdMap,
  compareWorkVersionsByDateCreatedDesc,
  workVersionNumberAtNewestFirstIndex,
} from './workVersionNumbers.js';

describe('workVersionNumbers', () => {
  const versions = [
    { id: 'wv-old', date_created: '2026-01-01T00:00:00.000Z' },
    { id: 'wv-mid', date_created: '2026-01-02T00:00:00.000Z' },
    { id: 'wv-new', date_created: '2026-01-03T00:00:00.000Z' },
  ];

  it('sorts versions newest-first', () => {
    expect([...versions].sort(compareWorkVersionsByDateCreatedDesc).map((v) => v.id)).toEqual([
      'wv-new',
      'wv-mid',
      'wv-old',
    ]);
  });

  it('builds v1 = oldest numbering from an unsorted list', () => {
    expect(buildWorkVersionNumberByIdMap(versions)).toEqual({
      'wv-old': 1,
      'wv-mid': 2,
      'wv-new': 3,
    });
  });

  it('maps index in a newest-first list to version numbers', () => {
    expect(workVersionNumberAtNewestFirstIndex(0, 3)).toBe(3);
    expect(workVersionNumberAtNewestFirstIndex(2, 3)).toBe(1);
  });
});
