import { describe, expect, test } from 'vitest';
import {
  ETL_HISTORY_DEFAULT_SINCE_HOURS,
  ETL_HISTORY_MAX_SINCE_DAYS,
  pickEtlHistoryVersion,
  resolveEtlHistorySince,
} from './history.server.js';

describe('resolveEtlHistorySince', () => {
  const now = new Date('2026-07-15T12:00:00.000Z');

  test('defaults to 24 hours ago when since is omitted', () => {
    const since = resolveEtlHistorySince(undefined, now);
    expect(since).toBe('2026-07-14T12:00:00.000Z');
  });

  test('accepts an ISO 8601 datetime within the lookback window', () => {
    const since = resolveEtlHistorySince('2026-07-13T08:30:00.000Z', now);
    expect(since).toBe('2026-07-13T08:30:00.000Z');
  });

  test('rejects values older than the max lookback', () => {
    expect(() => resolveEtlHistorySince('2026-07-01T00:00:00.000Z', now)).toThrow(
      `since must be within the last ${ETL_HISTORY_MAX_SINCE_DAYS} days`,
    );
  });

  test('rejects future timestamps', () => {
    expect(() => resolveEtlHistorySince('2026-07-16T00:00:00.000Z', now)).toThrow(
      'since must not be in the future',
    );
  });

  test('rejects invalid datetime strings', () => {
    expect(() => resolveEtlHistorySince('not-a-date', now)).toThrow(
      'since must be an ISO 8601 UTC datetime',
    );
  });

  test('uses the configured default window length', () => {
    expect(ETL_HISTORY_DEFAULT_SINCE_HOURS).toBe(24);
  });
});

describe('pickEtlHistoryVersion', () => {
  test('returns the first non-empty tag', () => {
    expect(pickEtlHistoryVersion(['v2', 'preprint'])).toBe('v2');
  });

  test('returns undefined when no tags are present', () => {
    expect(pickEtlHistoryVersion([])).toBeUndefined();
  });
});
