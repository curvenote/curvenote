// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { hyphenatedFromDate, utcDayFromDate } from './date.js';

describe('utcDayFromDate', () => {
  const originalTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = 'America/Los_Angeles';
  });

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('returns the UTC calendar day where the local day is the day before', () => {
    const date = new Date('2026-06-19');
    expect(hyphenatedFromDate(date)).toBe('2026-06-18');
    expect(utcDayFromDate(date)).toBe('2026-06-19');
  });

  it('returns the UTC calendar day for a timestamp late in the local day', () => {
    expect(utcDayFromDate(new Date('2026-06-19T23:30:00-07:00'))).toBe('2026-06-20');
  });
});
