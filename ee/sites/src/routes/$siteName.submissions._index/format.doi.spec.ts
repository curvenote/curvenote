/* eslint-disable import/no-extraneous-dependencies */
import { describe, expect, test } from 'vitest';
import { formatIndexItemDoi } from './format.server.js';

const version = (doi: string | null) => ({
  status: 'PUBLISHED',
  tags: [],
  work_version: { title: 't', authors: [], doi },
});

describe('formatIndexItemDoi', () => {
  test('a registered submission DOI wins', () => {
    expect(
      formatIndexItemDoi({
        doi: '10.62329/registered',
        work: { doi: '10.1000/work' },
        versions: [version('10.1000/version')],
      }),
    ).toBe('10.62329/registered');
  });

  test('falls back to the newest version DOI, then the work DOI', () => {
    expect(
      formatIndexItemDoi({
        doi: null,
        work: { doi: '10.1000/work' },
        versions: [version('10.1000/version')],
      }),
    ).toBe('10.1000/version');
    expect(
      formatIndexItemDoi({ doi: null, work: { doi: '10.1000/work' }, versions: [version(null)] }),
    ).toBe('10.1000/work');
    expect(formatIndexItemDoi({ doi: null, work: null, versions: [] })).toBeUndefined();
  });
});
