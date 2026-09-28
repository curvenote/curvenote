// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatPublicationDate } from './publicationDateCalendar.js';

describe('formatPublicationDate', () => {
  const originalTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = 'Asia/Tokyo';
  });

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('formats an ISO date as day month year', () => {
    expect(formatPublicationDate('2024-08-27')).toBe('27 August 2024');
  });

  it('keeps a non-padded calendar date on its own day', () => {
    expect(formatPublicationDate('2025-8-1')).toBe('1 August 2025');
  });

  it('shows a timestamp as its UTC day, not the local day', () => {
    expect(formatPublicationDate('2026-08-26T20:39:18.480Z')).toBe('26 August 2026');
  });

  it('returns an empty string for an unparseable date', () => {
    expect(formatPublicationDate('not a date')).toBe('');
  });
});
