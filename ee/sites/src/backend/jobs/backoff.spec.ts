// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { pastHorizon, pollDelayMinutes, scheduledAtAfter } from './backoff.js';

describe('poll backoff', () => {
  it('widens 1, 2, 5, 10, 30 and caps at 60 minutes', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 20].map(pollDelayMinutes)).toEqual([1, 2, 5, 10, 30, 60, 60, 60]);
  });

  it('returns an ISO timestamp after now', () => {
    expect(scheduledAtAfter(new Date('2026-09-21T10:00:00.000Z'), 3)).toBe(
      '2026-09-21T10:05:00.000Z',
    );
  });
});

describe('pastHorizon', () => {
  const row = (dateCreated: string) => ({ date_created: dateCreated }) as any;

  it('is false just under 72h and true just over it, shared by both job handlers', () => {
    const now = new Date('2026-09-21T10:00:00.000Z');
    expect(pastHorizon(row('2026-09-18T10:00:01.000Z'), now)).toBe(false);
    expect(pastHorizon(row('2026-09-18T09:59:59.000Z'), now)).toBe(true);
  });
});
