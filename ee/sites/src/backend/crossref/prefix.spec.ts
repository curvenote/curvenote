// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { normalizePrefix } from './prefix.js';

describe('normalizePrefix', () => {
  test.each([
    ['10.5555', '10.5555'],
    ['  10.5555  ', '10.5555'],
    ['10.5555/', '10.5555'],
    ['doi:10.5555', '10.5555'],
    ['DOI: 10.5555', '10.5555'],
    ['https://doi.org/10.5555', '10.5555'],
    ['https://doi.org/10.5555/', '10.5555'],
    ['http://dx.doi.org/10.5555', '10.5555'],
    ['doi.org/10.5555', '10.5555'],
    ['10.123456789', '10.123456789'],
    ['5555', '10.5555'],
    [' 123456789 ', '10.123456789'],
  ])('accepts %s', (raw, expected) => {
    expect(normalizePrefix(raw)).toBe(expected);
  });

  test.each([
    [''],
    ['10.12'],
    ['11.1234'],
    ['10.1234/abc'],
    ['10.1234567890'],
    ['https://example.org/10.5555'],
    ['ten.5555'],
    ['123'],
    ['1234567890'],
    ['.5555'],
  ])('rejects %s', (raw) => {
    expect(normalizePrefix(raw)).toBeNull();
  });
});
