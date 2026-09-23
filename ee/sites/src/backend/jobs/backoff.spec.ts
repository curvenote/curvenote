// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { pastHorizon, scheduledAtAfter } from './backoff.js';

describe('scheduledAtAfter', () => {
  it('widens 1, 2, 5, 10, 30 and caps at 60 minutes', () => {
    const now = new Date('2026-09-21T10:00:00.000Z');
    const minutes = [1, 2, 3, 4, 5, 6, 7, 20].map(
      (attempt) => (new Date(scheduledAtAfter(now, attempt)).getTime() - now.getTime()) / 60_000,
    );
    expect(minutes).toEqual([1, 2, 5, 10, 30, 60, 60, 60]);
  });

  it('returns an ISO timestamp', () => {
    expect(scheduledAtAfter(new Date('2026-09-21T10:00:00.000Z'), 3)).toBe(
      '2026-09-21T10:05:00.000Z',
    );
  });
});

describe('pastHorizon', () => {
  const row = (dateCreated: string) => ({ date_created: dateCreated }) as any;

  it('is false just under 72h and true just over it', () => {
    const now = new Date('2026-09-21T10:00:00.000Z');
    expect(pastHorizon(row('2026-09-18T10:00:01.000Z'), now)).toBe(false);
    expect(pastHorizon(row('2026-09-18T09:59:59.000Z'), now)).toBe(true);
  });
});
