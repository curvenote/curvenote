/**
 * Shared URL-state helpers, constants, and date math for the submissions
 * listing toolbar (search, sort, filter chips) and the route loader.
 *
 * The URL is the canonical source of truth for listing state. Every control
 * in the toolbar mutates the `URLSearchParams` through these helpers — never
 * directly — so:
 *  - `page` is always reset to 1 when any other param changes
 *  - multi-select filters share one CSV encoding (`kindIds=a,b,c`)
 *  - clearing filters strips a known set of keys
 *
 * Everything in this module is pure (`now` is injectable) and safe to call
 * from both server (route loader, where-clause builder) and client (toolbar
 * controls).
 */

/* -----------------------------------------------------------------------------
 * Sort
 * -------------------------------------------------------------------------- */

export const LISTING_SORTS = [
  'recent_published',
  'recent_created',
  'recent_activity',
  'title_az',
  'author_az',
] as const;

export type ListingSort = (typeof LISTING_SORTS)[number];

export const LISTING_SORT_DEFAULT: ListingSort = 'recent_published';

/**
 * Sorts that need denormalised Submission columns and ship in the follow-up
 * "denormalisation" slice. Rendered as disabled MenuItems in the sort menu;
 * the where/orderBy builders throw if they ever receive one of these so a
 * UI regression fails loudly rather than silently.
 *
 *  - `recent_activity`  → Submission.last_activity_at
 *  - `title_az`         → Submission.cached_title
 *  - `author_az`        → Submission.cached_first_author
 */
export const LISTING_SORTS_AWAITING_DENORMALISATION = new Set<ListingSort>([
  'recent_activity',
  'title_az',
  'author_az',
]);

export const LISTING_SORT_LABEL: Record<ListingSort, string> = {
  recent_published: 'Most recently published',
  recent_created: 'Most recently created',
  recent_activity: 'Most recent activity',
  title_az: 'Title A–Z',
  author_az: 'First author A–Z',
};

/* -----------------------------------------------------------------------------
 * Status options
 *
 * Filter applies to the *newest* SubmissionVersion's status (matching the
 * listing card semantics in `format.server.ts`). `is_listed = true` already
 * excludes DRAFT and INCOMPLETE submissions, so those are not offered.
 *
 * The set is intentionally narrow: the five terminal / stable states that
 * reviewers most often slice the list by. Transitional states (PUBLISHING,
 * UNPUBLISHING) and the workflow-specific IN_REVIEW / RETRACTED states are
 * deliberately omitted — they can be re-introduced if user feedback shows
 * demand for filtering by them. Note that UNPUBLISHED (the terminal state
 * reached after an unpublish job completes) is offered rather than
 * UNPUBLISHING (the transient in-progress status during the job).
 *
 * The options are surfaced unconditionally — even on sites where only one
 * status is in active use — so the toolbar stays predictable across sites.
 * -------------------------------------------------------------------------- */

export interface ListingStatusOption {
  id: string;
  name: string;
}

export const LISTING_STATUS_OPTIONS: readonly ListingStatusOption[] = [
  { id: 'PENDING', name: 'Pending' },
  { id: 'APPROVED', name: 'Approved' },
  { id: 'PUBLISHED', name: 'Published' },
  { id: 'UNPUBLISHED', name: 'Unpublished' },
  { id: 'REJECTED', name: 'Rejected' },
];

export const LISTING_STATUS_IDS: ReadonlySet<string> = new Set(
  LISTING_STATUS_OPTIONS.map((option) => option.id),
);

/* -----------------------------------------------------------------------------
 * Search
 *
 * Three characters is the smallest input that gives a useful result with
 * pg_trgm: trigrams are 3-character n-grams, so the GIN trigram indexes from
 * `20260526223800_add_submission_search_trgm_indexes` can only accelerate
 * substring lookups of length >= 3. Anything shorter falls back to a seqscan
 * and is also so non-specific that it returns nearly every row, drowning the
 * UI. Both the search input and the route loader's Zod schema enforce this
 * floor — the URL never carries `?q=` for sub-threshold input.
 * -------------------------------------------------------------------------- */

export const LISTING_SEARCH_MIN_LENGTH = 3;

/* -----------------------------------------------------------------------------
 * Parsed query shape
 *
 * Kept as an explicit interface (rather than `z.infer<typeof ListingQuerySchema>`)
 * so this file stays free of the zod dependency and stays usable from any
 * client component. The route loader's schema infers a type that satisfies
 * this interface.
 * -------------------------------------------------------------------------- */

export interface ListingQuery {
  page: number;
  perPage: number;
  q?: string;
  sort: ListingSort;
  kindIds: string[];
  collectionIds: string[];
  statuses: string[];
  from?: string;
  to?: string;
  /**
   * When true, the listing returns only submissions whose `date_published`
   * is NULL. Mutually exclusive with `from` / `to` — when this flag is set,
   * any range is ignored. Encoded in the URL as `?unpublishedOnly=1`.
   */
  unpublishedOnly: boolean;
}

export function hasActiveListingFiltersInQuery(query: ListingQuery): boolean {
  return Boolean(
    query.q ||
    query.kindIds.length ||
    query.collectionIds.length ||
    query.statuses.length ||
    query.from ||
    query.to ||
    query.unpublishedOnly,
  );
}

/* -----------------------------------------------------------------------------
 * Date range
 * -------------------------------------------------------------------------- */

export type ListingDatePresetId =
  | 'anytime'
  | 'today'
  | 'past_week'
  | 'past_month'
  | 'past_year'
  | 'custom'
  /**
   * Special "no value" mode — filters down to submissions where
   * `date_published` is NULL. Backed by the `unpublishedOnly` URL param
   * rather than `from` / `to`; mutually exclusive with the range presets.
   */
  | 'no_published_date';

export const LISTING_DATE_PRESETS: { id: ListingDatePresetId; label: string }[] = [
  { id: 'anytime', label: 'Anytime' },
  { id: 'today', label: 'Today' },
  { id: 'past_week', label: 'Past week' },
  { id: 'past_month', label: 'Past month' },
  { id: 'past_year', label: 'Past year' },
  { id: 'custom', label: 'Custom range' },
  { id: 'no_published_date', label: 'No Published Date' },
];

/** Presets that resolve to a concrete `from` / `to` window. */
export type ListingDateRangePresetId = Exclude<
  ListingDatePresetId,
  'anytime' | 'custom' | 'no_published_date'
>;

export const LISTING_DATE_PRESET_LABEL: Record<ListingDatePresetId, string> = Object.fromEntries(
  LISTING_DATE_PRESETS.map((preset) => [preset.id, preset.label]),
) as Record<ListingDatePresetId, string>;

function isoDate(d: Date): string {
  // Local-time YYYY-MM-DD — `toISOString()` would shift the day in any
  // non-UTC timezone, which throws preset matching off by one across DST
  // boundaries. Output remains lexicographically chronological so it still
  // compares correctly against `String?` date columns.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Concrete from/to dates for a relative preset, computed against `now`.
 * URLs store the resolved dates (not the preset name) so shared links remain
 * stable: a "Past week" link sent today shows the same window when opened
 * tomorrow.
 */
export function computeDatePresetRange(
  preset: ListingDateRangePresetId,
  now: Date = new Date(),
): { from: string; to: string } {
  const to = isoDate(now);
  const fromDate = new Date(now);
  switch (preset) {
    case 'today':
      break;
    case 'past_week':
      fromDate.setDate(fromDate.getDate() - 7);
      break;
    case 'past_month':
      fromDate.setMonth(fromDate.getMonth() - 1);
      break;
    case 'past_year':
      fromDate.setFullYear(fromDate.getFullYear() - 1);
      break;
  }
  return { from: isoDate(fromDate), to };
}

/**
 * Reverse-resolve the date-filter URL state to a preset id. Used to label the
 * date filter chip when the URL was set via a preset earlier the same day,
 * and to drive the active-row highlight in the popover.
 *
 * `unpublishedOnly` wins outright — when true, the active preset is
 * `no_published_date` regardless of `from` / `to` (which the loader ignores in
 * that mode anyway).
 *
 * Otherwise the function falls back to `custom` if the pair doesn't match
 * any preset for today.
 */
export function matchPresetForRange(
  from: string | undefined,
  to: string | undefined,
  unpublishedOnly: boolean,
  now: Date = new Date(),
): ListingDatePresetId {
  if (unpublishedOnly) return 'no_published_date';
  if (!from && !to) return 'anytime';
  const today = isoDate(now);
  if (to !== today) return 'custom';
  if (from === today) return 'today';
  if (from === computeDatePresetRange('past_week', now).from) return 'past_week';
  if (from === computeDatePresetRange('past_month', now).from) return 'past_month';
  if (from === computeDatePresetRange('past_year', now).from) return 'past_year';
  return 'custom';
}

/**
 * Inclusive upper bound expressed as the start of the next day, so SQL
 * `date < toExclusiveUpperBound(to)` matches all timestamps within `to`.
 * Built from UTC components so it never depends on the server timezone —
 * the comparison happens against ISO-string columns that always sort
 * chronologically by lexicographic order.
 */
export function toExclusiveDateUpperBound(toIsoDate: string): string {
  const next = new Date(`${toIsoDate}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, '0');
  const day = String(next.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* -----------------------------------------------------------------------------
 * URL search-params helpers
 *
 * Every mutation funnels through `setListingParam` so `page` is consistently
 * reset to 1. Components only ever build the next URLSearchParams via these.
 * -------------------------------------------------------------------------- */

export type ListingParamKey =
  | 'q'
  | 'sort'
  | 'kindIds'
  | 'collectionIds'
  | 'statuses'
  | 'from'
  | 'to'
  | 'unpublishedOnly';

/** Params that the "Clear filters" empty-state action wipes (sort is kept). */
const CLEARABLE_PARAMS: readonly ListingParamKey[] = [
  'q',
  'kindIds',
  'collectionIds',
  'statuses',
  'from',
  'to',
  'unpublishedOnly',
];

export function setListingParam(
  searchParams: URLSearchParams,
  key: ListingParamKey,
  value: string | undefined,
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  if (value === undefined || value === '') {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  next.delete('page');
  return next;
}

export function readListingCsvParam(searchParams: URLSearchParams, key: ListingParamKey): string[] {
  const raw = searchParams.get(key);
  if (!raw) return [];
  return raw.split(',').filter(Boolean);
}

export function setListingCsvParam(
  searchParams: URLSearchParams,
  key: ListingParamKey,
  values: readonly string[],
): URLSearchParams {
  return setListingParam(searchParams, key, values.length ? values.join(',') : undefined);
}

export function toggleListingCsvParam(
  searchParams: URLSearchParams,
  key: ListingParamKey,
  value: string,
): URLSearchParams {
  const current = readListingCsvParam(searchParams, key);
  const next = current.includes(value) ? current.filter((id) => id !== value) : [...current, value];
  return setListingCsvParam(searchParams, key, next);
}

export function clearListingFilters(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  for (const key of CLEARABLE_PARAMS) {
    next.delete(key);
  }
  next.delete('page');
  return next;
}

export function hasActiveListingFilters(searchParams: URLSearchParams): boolean {
  return CLEARABLE_PARAMS.some((key) => Boolean(searchParams.get(key)));
}
