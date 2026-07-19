// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect } from 'vitest';
import { computeNextRunAt, resolveRecordedNextRunAt } from './computeNextRunAt.server.js';

describe('computeNextRunAt', () => {
  it('returns the next slot after the reference time', () => {
    const next = computeNextRunAt('*/5 * * * *', 'UTC', new Date('2026-07-01T10:03:00.000Z'));
    expect(next).toBe('2026-07-01T10:05:00.000Z');
  });
});

describe('resolveRecordedNextRunAt', () => {
  it('keeps the claim-time slot when completion would compute an earlier slot', () => {
    const completion = new Date('2026-07-01T10:03:00.000Z');
    const claimedNext = '2026-07-01T10:05:00.000Z';
    const next = resolveRecordedNextRunAt('*/5 * * * *', 'UTC', completion, claimedNext);
    expect(next).toBe(claimedNext);
  });

  it('advances past the claim-time slot when completion crosses a boundary', () => {
    const completion = new Date('2026-07-01T10:06:00.000Z');
    const claimedNext = '2026-07-01T10:05:00.000Z';
    const next = resolveRecordedNextRunAt('*/5 * * * *', 'UTC', completion, claimedNext);
    expect(next).toBe('2026-07-01T10:10:00.000Z');
  });
});
