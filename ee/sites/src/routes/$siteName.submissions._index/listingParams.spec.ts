// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  LISTING_DATE_PRESETS,
  LISTING_SEARCH_MIN_LENGTH,
  LISTING_SORTS,
  LISTING_SORTS_AWAITING_DENORMALISATION,
  LISTING_STATUS_IDS,
  LISTING_STATUS_OPTIONS,
  clearListingFilters,
  computeDatePresetRange,
  hasActiveListingFilters,
  hasActiveListingFiltersInQuery,
  matchPresetForRange,
  readListingCsvParam,
  setListingCsvParam,
  setListingParam,
  toExclusiveDateUpperBound,
  toggleListingCsvParam,
} from './listingParams.js';

describe('listingParams: sort taxonomy', () => {
  it('marks the denormalisation-awaiting sorts as a subset of all sorts', () => {
    for (const sort of LISTING_SORTS_AWAITING_DENORMALISATION) {
      expect((LISTING_SORTS as readonly string[]).includes(sort)).toBe(true);
    }
  });

  it('keeps the disabled sorts in sync with the database builders', () => {
    // If this changes, also update the cases in db.server.ts buildListing*OrderBy.
    expect(LISTING_SORTS_AWAITING_DENORMALISATION).toEqual(new Set(['recent_activity']));
  });
});

describe('listingParams: URL helpers', () => {
  it('setListingParam writes a value and always resets page to 1', () => {
    const before = new URLSearchParams('page=4&q=stale');
    const after = setListingParam(before, 'q', 'fresh');
    expect(after.get('q')).toBe('fresh');
    expect(after.get('page')).toBeNull();
  });

  it('setListingParam deletes the key when value is empty', () => {
    const before = new URLSearchParams('q=something&page=3');
    const after = setListingParam(before, 'q', '');
    expect(after.get('q')).toBeNull();
    expect(after.get('page')).toBeNull();
  });

  it('setListingParam deletes the key when value is undefined', () => {
    const before = new URLSearchParams('from=2024-01-01&page=2');
    const after = setListingParam(before, 'from', undefined);
    expect(after.get('from')).toBeNull();
    expect(after.get('page')).toBeNull();
  });

  it('readListingCsvParam splits and drops empty entries', () => {
    const sp = new URLSearchParams('kindIds=a,,b,c,,');
    expect(readListingCsvParam(sp, 'kindIds')).toEqual(['a', 'b', 'c']);
  });

  it('readListingCsvParam returns [] for missing or empty params', () => {
    expect(readListingCsvParam(new URLSearchParams(), 'kindIds')).toEqual([]);
    expect(readListingCsvParam(new URLSearchParams('kindIds='), 'kindIds')).toEqual([]);
  });

  it('setListingCsvParam joins values and clears the key when empty', () => {
    const empty = setListingCsvParam(new URLSearchParams('page=3&kindIds=x'), 'kindIds', []);
    expect(empty.get('kindIds')).toBeNull();
    expect(empty.get('page')).toBeNull();

    const populated = setListingCsvParam(new URLSearchParams(), 'kindIds', ['a', 'b']);
    expect(populated.get('kindIds')).toBe('a,b');
  });

  it('toggleListingCsvParam adds a missing id and removes an existing one', () => {
    const added = toggleListingCsvParam(new URLSearchParams('kindIds=a,b'), 'kindIds', 'c');
    expect(added.get('kindIds')).toBe('a,b,c');

    const removed = toggleListingCsvParam(new URLSearchParams('kindIds=a,b,c'), 'kindIds', 'b');
    expect(removed.get('kindIds')).toBe('a,c');

    const lastRemoved = toggleListingCsvParam(new URLSearchParams('kindIds=a'), 'kindIds', 'a');
    expect(lastRemoved.get('kindIds')).toBeNull();
  });

  it('clearListingFilters wipes only the filter / search params and page', () => {
    const before = new URLSearchParams(
      'q=foo&kindIds=a&collectionIds=b&statuses=PENDING&from=2024-01-01&to=2024-01-31&unpublishedOnly=1&page=4&sort=recent_created&perPage=30',
    );
    const after = clearListingFilters(before);
    expect(after.get('q')).toBeNull();
    expect(after.get('kindIds')).toBeNull();
    expect(after.get('collectionIds')).toBeNull();
    expect(after.get('statuses')).toBeNull();
    expect(after.get('from')).toBeNull();
    expect(after.get('to')).toBeNull();
    expect(after.get('unpublishedOnly')).toBeNull();
    expect(after.get('page')).toBeNull();
    // sort and perPage are preserved.
    expect(after.get('sort')).toBe('recent_created');
    expect(after.get('perPage')).toBe('30');
  });

  it('hasActiveListingFilters reports true for any of the tracked params', () => {
    expect(hasActiveListingFilters(new URLSearchParams())).toBe(false);
    expect(hasActiveListingFilters(new URLSearchParams('sort=recent_created'))).toBe(false);
    expect(hasActiveListingFilters(new URLSearchParams('q=foo'))).toBe(true);
    expect(hasActiveListingFilters(new URLSearchParams('kindIds=a'))).toBe(true);
    expect(hasActiveListingFilters(new URLSearchParams('collectionIds=b'))).toBe(true);
    expect(hasActiveListingFilters(new URLSearchParams('statuses=PENDING'))).toBe(true);
    expect(hasActiveListingFilters(new URLSearchParams('from=2024-01-01'))).toBe(true);
    expect(hasActiveListingFilters(new URLSearchParams('to=2024-01-31'))).toBe(true);
    expect(hasActiveListingFilters(new URLSearchParams('unpublishedOnly=1'))).toBe(true);
  });

  it('hasActiveListingFiltersInQuery mirrors hasActiveListingFilters but for parsed queries', () => {
    const base = {
      page: 1,
      perPage: 15,
      sort: 'recent_published' as const,
      kindIds: [] as string[],
      collectionIds: [] as string[],
      statuses: [] as string[],
      unpublishedOnly: false,
    };
    expect(hasActiveListingFiltersInQuery(base)).toBe(false);
    expect(hasActiveListingFiltersInQuery({ ...base, kindIds: ['k'] })).toBe(true);
    expect(hasActiveListingFiltersInQuery({ ...base, statuses: ['PENDING'] })).toBe(true);
    expect(hasActiveListingFiltersInQuery({ ...base, q: 'photo' })).toBe(true);
    expect(hasActiveListingFiltersInQuery({ ...base, unpublishedOnly: true })).toBe(true);
  });

  it('toggleListingCsvParam works for the statuses key (same shape as other CSVs)', () => {
    const added = toggleListingCsvParam(new URLSearchParams(), 'statuses', 'PENDING');
    expect(added.get('statuses')).toBe('PENDING');
    const two = toggleListingCsvParam(added, 'statuses', 'PUBLISHED');
    expect(two.get('statuses')).toBe('PENDING,PUBLISHED');
    const removed = toggleListingCsvParam(two, 'statuses', 'PENDING');
    expect(removed.get('statuses')).toBe('PUBLISHED');
  });
});

describe('listingParams: search', () => {
  it('exposes a trigram-friendly minimum length of 3', () => {
    // Trigrams are 3-character n-grams, so the GIN trigram indexes can only
    // accelerate substrings of length >= 3. Both the input and the loader
    // schema rely on this constant.
    expect(LISTING_SEARCH_MIN_LENGTH).toBe(3);
  });
});

describe('listingParams: date taxonomy', () => {
  it('exposes "no_published_date" as a distinct preset after the range presets', () => {
    // The UI relies on this ordering: range presets come first, "No
    // Published Date" sits at the end so the popover can render a divider
    // between the two groups (range vs no-value).
    const ids = LISTING_DATE_PRESETS.map((p) => p.id);
    expect(ids[ids.length - 1]).toBe('no_published_date');
    expect(ids).toContain('anytime');
    expect(ids).toContain('custom');
  });

  it('labels "no_published_date" as "No Published Date" in the menu', () => {
    const preset = LISTING_DATE_PRESETS.find((p) => p.id === 'no_published_date');
    expect(preset?.label).toBe('No Published Date');
  });
});

describe('listingParams: status taxonomy', () => {
  it('exposes a non-empty set of status options', () => {
    expect(LISTING_STATUS_OPTIONS.length).toBeGreaterThan(0);
  });

  it('every option appears in LISTING_STATUS_IDS', () => {
    for (const option of LISTING_STATUS_OPTIONS) {
      expect(LISTING_STATUS_IDS.has(option.id)).toBe(true);
    }
    expect(LISTING_STATUS_IDS.size).toBe(LISTING_STATUS_OPTIONS.length);
  });

  it('excludes DRAFT and INCOMPLETE (already filtered by Submission.is_listed)', () => {
    expect(LISTING_STATUS_IDS.has('DRAFT')).toBe(false);
    expect(LISTING_STATUS_IDS.has('INCOMPLETE')).toBe(false);
  });

  it('offers exactly the curated five-status set', () => {
    expect(LISTING_STATUS_OPTIONS.map((option) => option.id)).toEqual([
      'PENDING',
      'APPROVED',
      'PUBLISHED',
      'UNPUBLISHED',
      'REJECTED',
    ]);
  });

  it('excludes transitional and workflow-specific statuses', () => {
    // PUBLISHING / UNPUBLISHING are transient job states; IN_REVIEW and
    // RETRACTED are workflow-specific and deliberately omitted until product
    // feedback shows demand. See the comment block in listingParams.ts.
    for (const id of ['PUBLISHING', 'UNPUBLISHING', 'IN_REVIEW', 'RETRACTED']) {
      expect(LISTING_STATUS_IDS.has(id)).toBe(false);
    }
  });
});

describe('listingParams: date math', () => {
  const fixedNow = new Date(2026, 4, 15); // local time May 15 2026

  it('computeDatePresetRange("today") collapses from === to', () => {
    const range = computeDatePresetRange('today', fixedNow);
    expect(range).toEqual({ from: '2026-05-15', to: '2026-05-15' });
  });

  it('computeDatePresetRange("past_week") goes back 7 days', () => {
    const range = computeDatePresetRange('past_week', fixedNow);
    expect(range).toEqual({ from: '2026-05-08', to: '2026-05-15' });
  });

  it('computeDatePresetRange("past_month") goes back one calendar month', () => {
    const range = computeDatePresetRange('past_month', fixedNow);
    expect(range).toEqual({ from: '2026-04-15', to: '2026-05-15' });
  });

  it('computeDatePresetRange("past_year") goes back one calendar year', () => {
    const range = computeDatePresetRange('past_year', fixedNow);
    expect(range).toEqual({ from: '2025-05-15', to: '2026-05-15' });
  });

  it('computeDatePresetRange("past_month") clamps the day when the target month is shorter', () => {
    // Regression: a naive `setMonth(getMonth() - 1)` on May 31 tries to
    // build April 31, which JS Date silently rolls forward to May 1 —
    // putting `from` *after* the start of the current month. The correct
    // behaviour is to clamp to the last day of the target month
    // (2026-04-30 here).
    const may31 = new Date(2026, 4, 31); // local May 31 2026
    expect(computeDatePresetRange('past_month', may31)).toEqual({
      from: '2026-04-30',
      to: '2026-05-31',
    });

    // March 31 → February (28 days in 2026)
    const mar31 = new Date(2026, 2, 31);
    expect(computeDatePresetRange('past_month', mar31)).toEqual({
      from: '2026-02-28',
      to: '2026-03-31',
    });

    // March 31 in a leap year → February 29
    const mar31Leap = new Date(2024, 2, 31);
    expect(computeDatePresetRange('past_month', mar31Leap)).toEqual({
      from: '2024-02-29',
      to: '2024-03-31',
    });
  });

  it('computeDatePresetRange("past_year") clamps Feb 29 of a leap year to Feb 28 of the prior year', () => {
    // Regression: a naive `setFullYear(getFullYear() - 1)` on Feb 29 of a
    // leap year tries to build Feb 29 of the prior (non-leap) year, which
    // JS Date silently rolls forward to March 1.
    const feb29 = new Date(2024, 1, 29); // local Feb 29 2024 (leap)
    expect(computeDatePresetRange('past_year', feb29)).toEqual({
      from: '2023-02-28',
      to: '2024-02-29',
    });
  });

  it('matchPresetForRange returns "anytime" when neither bound is set', () => {
    expect(matchPresetForRange(undefined, undefined, false, fixedNow)).toBe('anytime');
  });

  it('matchPresetForRange recognises today / past_week / past_month / past_year', () => {
    const week = computeDatePresetRange('past_week', fixedNow);
    expect(matchPresetForRange(week.from, week.to, false, fixedNow)).toBe('past_week');

    const today = computeDatePresetRange('today', fixedNow);
    expect(matchPresetForRange(today.from, today.to, false, fixedNow)).toBe('today');

    const month = computeDatePresetRange('past_month', fixedNow);
    expect(matchPresetForRange(month.from, month.to, false, fixedNow)).toBe('past_month');

    const year = computeDatePresetRange('past_year', fixedNow);
    expect(matchPresetForRange(year.from, year.to, false, fixedNow)).toBe('past_year');
  });

  it('matchPresetForRange falls back to "custom" when "to" is not today', () => {
    expect(matchPresetForRange('2024-01-01', '2024-01-15', false, fixedNow)).toBe('custom');
  });

  it('matchPresetForRange returns "no_published_date" whenever unpublishedOnly is set', () => {
    // unpublishedOnly is the dominant signal — even if `from` / `to` happen
    // to match a preset, the active mode is "no_published_date" because the
    // loader ignores the range in that case.
    expect(matchPresetForRange(undefined, undefined, true, fixedNow)).toBe('no_published_date');
    const week = computeDatePresetRange('past_week', fixedNow);
    expect(matchPresetForRange(week.from, week.to, true, fixedNow)).toBe('no_published_date');
  });

  it('toExclusiveDateUpperBound returns the start of the next day', () => {
    expect(toExclusiveDateUpperBound('2024-01-31')).toBe('2024-02-01');
    expect(toExclusiveDateUpperBound('2024-12-31')).toBe('2025-01-01');
    expect(toExclusiveDateUpperBound('2024-02-28')).toBe('2024-02-29');
  });
});
