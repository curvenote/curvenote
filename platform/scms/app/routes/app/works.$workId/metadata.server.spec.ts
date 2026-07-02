// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { resolveWorkVersionDoi } from './metadata.server';

describe('resolveWorkVersionDoi', () => {
  it('prefers a non-empty version DOI', () => {
    expect(resolveWorkVersionDoi('10.1234/version', '10.1234/work')).toBe('10.1234/version');
  });

  it('falls back to work DOI when version DOI is empty or whitespace', () => {
    expect(resolveWorkVersionDoi('', '10.1234/work')).toBe('10.1234/work');
    expect(resolveWorkVersionDoi('   ', '10.1234/work')).toBe('10.1234/work');
  });

  it('falls back to work DOI when version DOI is null or undefined', () => {
    expect(resolveWorkVersionDoi(null, '10.1234/work')).toBe('10.1234/work');
    expect(resolveWorkVersionDoi(undefined, '10.1234/work')).toBe('10.1234/work');
  });

  it('returns null when both version and work DOI are unset or blank', () => {
    expect(resolveWorkVersionDoi('', null)).toBeNull();
    expect(resolveWorkVersionDoi('  ', ' ')).toBeNull();
    expect(resolveWorkVersionDoi(null, undefined)).toBeNull();
  });

  it('trims whitespace from the chosen DOI', () => {
    expect(resolveWorkVersionDoi('  10.1234/version  ', '10.1234/work')).toBe('10.1234/version');
    expect(resolveWorkVersionDoi('', '  10.1234/work  ')).toBe('10.1234/work');
  });
});
