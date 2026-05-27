# Follow-up Plan: Submissions Listing Denormalisation Slice

## Goal

After the new submissions index listing has been user-tested and the product
behaviour around "current status", "activity", and listing sort order is
settled, denormalise four computed fields onto the `Submission` row so the
parked controls (status filter fast path, three sort options) move off the
correlated-subquery path and onto a single index scan.

This is the deliberately-deferred follow-up to the search + filter + sort
slice that landed in November 2026. We are pausing here because:

- The Status filter, "Most recent activity" sort, "Title A–Z" sort, and
  "First author A–Z" sort each carry product questions that should be
  resolved through real usage of the new listing before we commit them to
  the database schema.
- The current implementation already exposes the Status filter via a
  correlated subquery (it works, just not on the partial-index fast path),
  and the three sorts are surfaced as disabled menu items with a "Soon"
  hint, so the UX surface area is in front of users today without forcing
  the schema decision.
- If a user request for one of the parked sorts arrives sooner than
  expected, the **[Stopgap option](#stopgap-option-correlated-subquery-sorts)**
  below can ship them in a few hours via correlated subqueries — same row
  semantics as the eventual columns, slower at scale. The stopgap was
  considered and **explicitly not taken** when the listing first shipped;
  we revisit it only if user / product feedback raises the priority of
  one of the parked sorts before the full slice is ready.

## Current baseline

The listing route is
[`ee/sites/src/routes/$siteName.submissions._index/`](../../ee/sites/src/routes/$siteName.submissions._index).
Two execution paths share the same WHERE / ORDER BY builders in
[`db.server.ts`](../../ee/sites/src/routes/$siteName.submissions._index/db.server.ts):

| Path                | Triggered when                       | Backing index                                                                                                                                                    |
| ------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma fast path    | `q` is empty AND `statuses` is empty | `Submission_is_listed_listing_idx` (partial)                                                                                                                     |
| Raw SQL search path | `q` is set OR `statuses` is set      | pg_trgm GIN indexes on `WorkVersion.title`, `WorkVersion.doi`, `Work.doi`, and `immutable_array_to_string(WorkVersion.authors, ' ')` (plus the correlated status subquery) |

The `is_listed` column is already maintained by the trigger function
`submission_recompute_listing_fields`, added in migration
[`20260526120000_add_submission_is_listed`](../../prisma/schema/migrations/20260526120000_add_submission_is_listed/migration.sql).
The function was deliberately named generically and structured around a
`COALESCE(NEW.submission_id, OLD.submission_id)` lookup so the next slice
extends the same function body rather than introducing new triggers.

The trigger fires on:

- `AFTER INSERT OR DELETE ON SubmissionVersion`
- `AFTER UPDATE OF status ON SubmissionVersion`
  (`WHEN OLD.status IS DISTINCT FROM NEW.status`)

Sorts that depend on the new columns are listed in
[`listingParams.ts`](../../ee/sites/src/routes/$siteName.submissions._index/listingParams.ts)
under `LISTING_SORTS_AWAITING_DENORMALISATION` and rendered as disabled
items by `SubmissionsSortButton`. The `buildListingPrismaOrderBy` and
`buildListingRawSqlOrderBy` switches in `db.server.ts` `throw` for these
cases so a regression that exposes one of them fails loudly in tests.

## Proposed columns

Four denormalised columns on `Submission`, all maintained by the existing
`submission_recompute_listing_fields` trigger function:

| Column                | Type              | Source-of-truth                                                                                            | Unlocks                 |
| --------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------- |
| `active_status`       | `TEXT`            | Newest `SubmissionVersion.status` by `date_created`                                                        | Status filter fast path |
| `last_activity_at`    | `TEXT` (ISO-8601) | `MAX(Activity.date_created)` over the submission, fallback to `Submission.date_created` if no activity yet | `sort=recent_activity`  |
| `cached_title`        | `TEXT`            | Newest `WorkVersion.title`                                                                                 | `sort=title_az`         |
| `cached_first_author` | `TEXT NULL`       | `authors[1]` of the newest `WorkVersion`, normalised to lowercase for case-insensitive sort                | `sort=author_az`        |

### Recommended semantics

**`active_status` = newest version's status, no exclusion list.**

`is_listed = true` already guarantees no version is `DRAFT` or `INCOMPLETE`,
so for any listed row the newest version's status is necessarily one of:
`PENDING`, `IN_REVIEW`, `APPROVED`, `PUBLISHING`, `PUBLISHED`,
`UNPUBLISHED`, `REJECTED`, `RETRACTED`. The denormalised column stores the
literal newest status so the chip in
[`format.server.ts`](../../ee/sites/src/routes/$siteName.submissions._index/format.server.ts)
and the cached column never disagree.

The filter dropdown (`LISTING_STATUS_OPTIONS`) currently offers a curated
subset of those values — `PENDING`, `APPROVED`, `PUBLISHED`, `UNPUBLISHED`,
`REJECTED` — chosen for the most common reviewer slices. Transitional
states (`PUBLISHING`, `UNPUBLISHING`) and workflow-specific states
(`IN_REVIEW`, `RETRACTED`) are not offered today; they can be added back to
the dropdown without any column / index change once user feedback asks for
them.

The current correlated-subquery filter already implements this semantic,
and the integration test
`statuses honours the *newest* version when an older version differs` in
[`platform/scms/tests/integration/workflow/submissions-index-search.spec.ts`](../../platform/scms/tests/integration/workflow/submissions-index-search.spec.ts)
locks the contract. The fast-path implementation will pass the same test
without modification.

**`last_activity_at` = `MAX(Activity.date_created) WHERE submission_id = X`**,
falling back to `Submission.date_created` when no activity exists yet. The
fallback keeps newly-created submissions sortable without a NULL gap at
the top of the list.

**`cached_title` = newest `WorkVersion.title`.** Matches the listing card.

**`cached_first_author` = first entry of the newest `WorkVersion.authors`
array, normalised to lowercase.** The lowercase normalisation lets us index
the column directly for `ORDER BY` without `LOWER()` expression indexes,
and matches typical "First author A–Z" alphabetical expectations
("brontë, emily" sorts next to "Brontë, Emily"). NULL is allowed because
some rows may have an empty author list.

## Migration template

The migration mirrors `20260526120000_add_submission_is_listed`: column +
backfill + extended trigger function + partial indexes.

```sql
-- 1. Columns
ALTER TABLE "Submission"
  ADD COLUMN "active_status"      TEXT,
  ADD COLUMN "last_activity_at"   TEXT,
  ADD COLUMN "cached_title"       TEXT,
  ADD COLUMN "cached_first_author" TEXT;

-- 2. Backfill from current state
UPDATE "Submission" s
SET
  active_status = (
    SELECT sv.status FROM "SubmissionVersion" sv
    WHERE sv.submission_id = s.id
    ORDER BY sv.date_created DESC
    LIMIT 1
  ),
  last_activity_at = COALESCE(
    (SELECT MAX(a.date_created) FROM "Activity" a WHERE a.submission_id = s.id),
    s.date_created
  ),
  cached_title = (
    SELECT wv.title FROM "SubmissionVersion" sv
    JOIN "WorkVersion" wv ON wv.id = sv.work_version_id
    WHERE sv.submission_id = s.id
    ORDER BY sv.date_created DESC
    LIMIT 1
  ),
  cached_first_author = (
    SELECT LOWER(wv.authors[1]) FROM "SubmissionVersion" sv
    JOIN "WorkVersion" wv ON wv.id = sv.work_version_id
    WHERE sv.submission_id = s.id
    ORDER BY sv.date_created DESC
    LIMIT 1
  );

-- 3. Extend the existing recompute function. Same triggers, same
--    invocation surface — only the function body grows.
CREATE OR REPLACE FUNCTION submission_recompute_listing_fields() RETURNS TRIGGER AS $$
DECLARE
  affected_id TEXT;
BEGIN
  affected_id := COALESCE(NEW.submission_id, OLD.submission_id);

  UPDATE "Submission" s
  SET
    is_listed = (
      EXISTS (SELECT 1 FROM "SubmissionVersion" v
              WHERE v.submission_id = affected_id)
      AND NOT EXISTS (
        SELECT 1 FROM "SubmissionVersion" v
        WHERE v.submission_id = affected_id
          AND v.status IN ('DRAFT','INCOMPLETE')
      )
    ),
    active_status = (
      SELECT sv.status FROM "SubmissionVersion" sv
      WHERE sv.submission_id = affected_id
      ORDER BY sv.date_created DESC
      LIMIT 1
    ),
    cached_title = (
      SELECT wv.title FROM "SubmissionVersion" sv
      JOIN "WorkVersion" wv ON wv.id = sv.work_version_id
      WHERE sv.submission_id = affected_id
      ORDER BY sv.date_created DESC
      LIMIT 1
    ),
    cached_first_author = (
      SELECT LOWER(wv.authors[1]) FROM "SubmissionVersion" sv
      JOIN "WorkVersion" wv ON wv.id = sv.work_version_id
      WHERE sv.submission_id = affected_id
      ORDER BY sv.date_created DESC
      LIMIT 1
    )
  WHERE s.id = affected_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Separate function + trigger for `last_activity_at` — fires on Activity
--    writes, not on SubmissionVersion writes, so it is intentionally
--    separate from the recompute function.
CREATE OR REPLACE FUNCTION submission_touch_last_activity() RETURNS TRIGGER AS $$
DECLARE
  affected_id TEXT;
BEGIN
  affected_id := COALESCE(NEW.submission_id, OLD.submission_id);
  IF affected_id IS NULL THEN
    RETURN NULL;
  END IF;
  UPDATE "Submission"
  SET last_activity_at = (
    SELECT COALESCE(
      MAX(a.date_created),
      "Submission".date_created
    )
    FROM "Activity" a
    WHERE a.submission_id = affected_id
  )
  WHERE id = affected_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER submission_touch_last_activity_iud
AFTER INSERT OR UPDATE OR DELETE ON "Activity"
FOR EACH ROW EXECUTE FUNCTION submission_touch_last_activity();

-- 5. Partial indexes sized exactly for each parked sort/filter
CREATE INDEX "Submission_active_status_listing_idx"
  ON "Submission" (site_id, active_status, date_published DESC)
  WHERE is_listed = TRUE;

CREATE INDEX "Submission_last_activity_listing_idx"
  ON "Submission" (site_id, last_activity_at DESC, id)
  WHERE is_listed = TRUE;

CREATE INDEX "Submission_cached_title_listing_idx"
  ON "Submission" (site_id, cached_title, id)
  WHERE is_listed = TRUE;

CREATE INDEX "Submission_cached_first_author_listing_idx"
  ON "Submission" (site_id, cached_first_author, id)
  WHERE is_listed = TRUE;
```

## Code changes once the migration lands

All edits are local to
[`ee/sites/src/routes/$siteName.submissions._index/db.server.ts`](../../ee/sites/src/routes/$siteName.submissions._index/db.server.ts).
No changes to the URL contract, the React components, or the integration
tests should be required — the existing tests assert behaviour, not
implementation path.

1. **Prisma schema** — add the four fields to `model Submission` in
   `prisma/schema/submission.prisma`, then `prisma generate`.

2. **`buildListingPrismaWhere`** — add the status branch so the fast path
   handles it:

   ```ts
   if (query.statuses.length) {
     where.active_status = { in: query.statuses };
   }
   ```

3. **`needsRawSqlPath`** — drop the `query.statuses.length > 0` clause so
   only `q` forces the search path:

   ```ts
   return Boolean(query.q);
   ```

4. **`buildListingRawSqlWhere`** — replace the correlated subquery with
   the same `s.active_status IN (...)` predicate so combined `q + status`
   queries still benefit from the column.

5. **`buildListingPrismaOrderBy` and `buildListingRawSqlOrderBy`** — flip
   each `throw` to a real `ORDER BY`:

   ```ts
   case 'recent_activity':
     return [{ last_activity_at: 'desc' }, { id: 'asc' }];
   case 'title_az':
     return [{ cached_title: 'asc' }, { id: 'asc' }];
   case 'author_az':
     return [{ cached_first_author: 'asc' }, { id: 'asc' }];
   ```

6. **`listingParams.ts`** — remove the entries from
   `LISTING_SORTS_AWAITING_DENORMALISATION` as each column lands. The
   sort menu becomes self-updating; the disabled state and "Soon" hint
   disappear automatically.

7. **Loader schema** — the `sort` schema in
   [`route.tsx`](../../ee/sites/src/routes/$siteName.submissions._index/route.tsx)
   currently coerces awaiting-denormalisation sorts to the default via
   the same `LISTING_SORTS_AWAITING_DENORMALISATION` set. No change needed
   — it auto-relaxes once the set shrinks.

## Stopgap option: correlated-subquery sorts

If user feedback for the parked sorts arrives before the open product
questions below are settled, we can unblock them without shipping the
migration. The cost is roughly half a day of focused work and a performance
profile that degrades on large sites — but it produces the same row order
as the eventual denormalised columns, so the integration tests it ships
with also lock the contract for the full slice.

### Mechanism

Each of the three parked sorts gets an `ORDER BY` clause built from a
correlated subquery, and the existing `needsRawSqlPath` is extended so
these sorts force the raw SQL path (the Prisma fast path can't express
them).

```ts
// listingParams.ts — rename the parked set so it reflects new semantics.
// `route.tsx` reads this same set for sort coercion; no other changes
// needed.
export const LISTING_SORTS_LOW_PERF: ReadonlySet<ListingSort> = new Set([
  'recent_activity',
  'title_az',
  'author_az',
]);

// db.server.ts — extend needsRawSqlPath
function needsRawSqlPath(query: ListingQuery): boolean {
  return (
    Boolean(query.q) ||
    query.statuses.length > 0 ||
    LISTING_SORTS_LOW_PERF.has(query.sort)
  );
}

// db.server.ts — buildListingRawSqlOrderBy
case 'recent_activity':
  return Prisma.sql`
    (SELECT MAX(a.date_created)
       FROM "Activity" a
      WHERE a.submission_id = s.id) DESC NULLS LAST,
    s.id ASC
  `;

case 'title_az':
  return Prisma.sql`
    (SELECT wv.title
       FROM "SubmissionVersion" sv
       JOIN "WorkVersion" wv ON wv.id = sv.work_version_id
      WHERE sv.submission_id = s.id
      ORDER BY sv.date_created DESC
      LIMIT 1) ASC NULLS LAST,
    s.id ASC
  `;

case 'author_az':
  return Prisma.sql`
    (SELECT LOWER(wv.authors[1])
       FROM "SubmissionVersion" sv
       JOIN "WorkVersion" wv ON wv.id = sv.work_version_id
      WHERE sv.submission_id = s.id
      ORDER BY sv.date_created DESC
      LIMIT 1) ASC NULLS LAST,
    s.id ASC
  `;
```

`buildListingPrismaOrderBy` keeps the `throw` for these three cases —
`needsRawSqlPath` ensures it is never reached for them.

### UI changes

- [`SubmissionsSortButton.tsx`](../../ee/sites/src/routes/$siteName.submissions._index/SubmissionsSortButton.tsx)
  — drop the `disabled` branch and the "Soon" hint. The menu items become
  active.
- The compile-time exhaustiveness checks in
  [`db.server.ts`](../../ee/sites/src/routes/$siteName.submissions._index/db.server.ts)
  already cover all three sorts via the `switch (query.sort)` shape, so no
  type-checker plumbing changes.

### Trade-offs

| Pro                                                                                       | Con                                                                                                  |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Ships the three sorts without a migration                                                 | Each request scans the joined dataset before sorting; LIMIT/OFFSET can't be pushed past the sort     |
| Same row order as the eventual denormalised columns — tests double as a forward contract  | Performance degrades with submission count; bad on >100K-row sites                                   |
| Reversible — flipping to the indexed columns is a one-line change per sort                | Worse worst-case latency for users hitting the slow sorts                                            |
| Surfaces product feedback faster (open questions can be answered with the surface in use) | Doesn't move the Status filter off its own correlated-subquery path (orthogonal — see the full slice)|

### When this makes sense

Pick this path if:

- The first request for one of the three sorts arrives while the product
  questions below are still open.
- Site size is small enough that the per-page cost (join + sort) is
  acceptable. Rough rule of thumb: under ~10K submissions per site is
  comfortable; above that, profile before deciding.
- We want test coverage for the sort semantics *before* the migration is
  written, so the migration only has to prove "produces the same order".

Otherwise: stay parked and ship the full slice when the un-parking
criteria below are met. The disabled chips with the "Soon" hint are
honest about the missing capability.

### Migration to the full slice

Once the columns and indexes from the previous section land:

1. Replace each correlated subquery in the `ORDER BY` switches with the
   indexed column form documented in **Code changes once the migration
   lands**.
2. Drop the `LISTING_SORTS_LOW_PERF` extension in `needsRawSqlPath` —
   sorts no longer force the raw SQL path.
3. Re-introduce the `throw` in `buildListingRawSqlOrderBy` for these
   sorts (or just delete the cases — the Prisma path handles them now).
4. The integration tests shipped with this stopgap continue to pass
   unchanged — they assert the row order, not the execution plan, so they
   double as a forward contract on the indexed implementation.

## Tests already locking the contract

These pass today against the correlated-subquery implementation and must
continue passing against the fast-path implementation. They live in
[`platform/scms/tests/integration/workflow/submissions-index-search.spec.ts`](../../platform/scms/tests/integration/workflow/submissions-index-search.spec.ts):

- `statuses=[PENDING] returns only rows whose newest version is PENDING`
- `statuses=[APPROVED,PUBLISHED] is the union of both`
- `statuses=[RETRACTED] yields no rows when none are seeded`
- `statuses honours the *newest* version when an older version differs`
- `statuses combines with kindIds to narrow further`
- `statuses combines with q to narrow further`

New tests required for the slice:

- `sort=recent_activity` orders by `last_activity_at desc` and falls back
  to `date_created` when no activity exists yet.
- `sort=title_az` orders by lowercase title.
- `sort=author_az` orders by lowercase first author, with NULL-author rows
  sorted last (or first — to be decided).
- Trigger correctness: inserting an `Activity` row updates
  `last_activity_at`; renaming the newest `WorkVersion.title` (TBD —
  see open questions) updates `cached_title`.

## Open product questions

These are the reasons this is parked. Each (except §4, which has been
resolved against the established sort pattern) needs an answer before the
migration ships. Numbering is preserved so external references stay
stable; resolved questions stay in place with a "resolved" note.

### 1. `active_status` definition

Recommended above (newest version's status, no exclusion list). Alternative
definitions to consider only if user testing surfaces a concrete need:

- **Skip terminal states (`RETRACTED`, `REJECTED`).** A retracted submission
  files under whatever it was before retraction. Loses the ability to filter
  for "retracted submissions" by status, and diverges from the listing card.
- **Skip transitional states (`PUBLISHING`, `UNPUBLISHING`).** Same
  divergence problem, plus turns the skip list into a workflow-config
  artefact.

### 2. `last_activity_at` scope

What counts as "activity"?

- Every `Activity` row (current proposal).
- Only user-initiated activity (filter out system-generated events).
- Status transitions only.

Implication for the trigger: option 2 or 3 would require either a
`WHERE` clause in the `submission_touch_last_activity` body, or a
filtered `last_activity_at` column with documented semantics.

### 3. `cached_title` / `cached_first_author` invalidation

The recompute trigger fires on `SubmissionVersion` writes. But the title
and authors live on `WorkVersion`, not `SubmissionVersion`. If a user
edits a `WorkVersion.title` directly (without writing a new
`SubmissionVersion`), the cached column becomes stale.

Three options:

1. **Accept staleness** — `WorkVersion.title` is effectively immutable
   after upload in the current product; verify this assumption.
2. **Add a trigger on `WorkVersion` UPDATE** — fires
   `submission_recompute_listing_fields` for every Submission whose
   newest version references the changed `WorkVersion`. Adds a join in
   the trigger body but keeps the cached value in sync.
3. **Recompute lazily in app code** — every code path that mutates
   `WorkVersion.title`/`authors` calls the recompute helper. Fragile.

The current trigger is fast (single-row UPDATE keyed by `submission_id`).
Option 2 is the safer choice if `WorkVersion` mutation is real.

### 4. Tie-breakers for the new sorts — **resolved**

All three new sorts append `id ASC` as the final tie-breaker so LIMIT/OFFSET
pagination is deterministic across separate queries. This matches the
established pattern in `buildListingPrismaOrderBy` and
`buildListingRawSqlOrderBy`, which both pin the existing sorts to:

- `recent_published`: `date_published DESC, date_created DESC, id ASC`
- `recent_created`: `date_created DESC, id ASC`

The `id ASC` suffix was added to the Prisma fast path after the initial
listing slice shipped, to bring it in line with the raw SQL path (which had
shipped with the tie-breaker from day one). The migration template above
already reflects this — every partial index that backs a parked sort
includes `id` as a trailing column so the indexed ORDER BY can satisfy the
secondary key without a Sort step.

### 5. NULL placement for `cached_first_author`

When the authors list is empty, where in the A–Z order does the row sit?
Postgres default is NULLS LAST for `ASC`, which is probably what users
expect ("rows with no author drift to the bottom"), but worth verifying
against the design.

## Decision criteria for un-parking

The full slice (columns + triggers + indexes) should land when **at least
two** of the following are true:

- Users on the new listing have asked for the disabled sorts to work.
- The Status filter is used heavily enough that its raw-SQL cost is
  meaningfully visible in `EXPLAIN ANALYZE` of the listing page on a
  high-volume site (>500K submissions).
- The product team has settled on the answer to question 1 (`active_status`
  definition) — even if no other slice work has happened, that answer
  alone unblocks the column.

The stopgap option above is a strictly weaker bar — a single user request
for any of the three parked sorts on a sub-10K site is reasonable cause to
take it, since it costs hours not days and the resulting tests pay forward
into the full slice.

## Relationship to broader work

- `Submission.is_listed` (migration `20260526120000`) — same trigger
  function this slice extends.
- pg_trgm trigram indexes (migration `20260526223800`) — orthogonal; this
  slice does not affect search.
- The new listing UI components in
  [`ee/sites/src/routes/$siteName.submissions._index/`](../../ee/sites/src/routes/$siteName.submissions._index)
  — no expected changes to the components themselves.
