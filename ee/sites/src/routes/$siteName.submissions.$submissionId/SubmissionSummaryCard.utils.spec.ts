import { describe, expect, it } from 'vitest';
import { authorInitials, getDoiHref, getNamedAuthors } from './SubmissionSummaryCard.utils.js';

describe('authorInitials', () => {
  it('uses first and last name initials for multi-word names', () => {
    expect(authorInitials('Ada Lovelace')).toBe('AL');
  });

  it('uses the first two characters for single-word names', () => {
    expect(authorInitials('Ada')).toBe('AD');
  });

  it('returns an empty string for whitespace-only names', () => {
    expect(authorInitials('   ')).toBe('');
  });

  it('ignores extra whitespace between name parts', () => {
    expect(authorInitials('  Grace   Hopper  ')).toBe('GH');
  });
});

describe('getNamedAuthors', () => {
  it('drops authors with empty or whitespace-only names', () => {
    expect(
      getNamedAuthors([
        { name: 'Ada Lovelace' },
        { name: '  ' },
        { name: '' },
        { name: 'Grace Hopper' },
      ]),
    ).toEqual([{ name: 'Ada Lovelace' }, { name: 'Grace Hopper' }]);
  });

  it('returns an empty array when authors is undefined', () => {
    expect(getNamedAuthors(undefined)).toEqual([]);
  });
});

describe('getDoiHref', () => {
  it('builds a resolver URL when a DOI is provided', () => {
    expect(getDoiHref('10.1234/example')).toBe('https://doi.org/10.1234/example');
  });

  it('returns undefined when no DOI is provided', () => {
    expect(getDoiHref(undefined)).toBeUndefined();
  });
});
