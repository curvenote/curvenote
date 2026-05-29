# Follow-up Plan: Public Works Listing Performance

## Endpoint

`GET /v1/sites/:siteName/works` — the public, cache-fronted works listing.
Co-located in a folder route so the handler, DB layer, and formatter optimise
together:

- [`route.tsx`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/route.tsx)
- [`db.server.ts`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/db.server.ts)
- [`format.server.ts`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/format.server.ts)

A golden-payload regression test locks the delivered DTO (shape, ordering,
pagination envelope, field mapping) so every optimisation below can be proven
behaviour-preserving:
[`tests/integration/workflow/site-works-listing.spec.ts`](../../platform/scms/tests/integration/workflow/site-works-listing.spec.ts).

## What has landed

| # | Change | Effect |
| - | ------ | ------ |
| 1 | `dbCountSubmissions` rewritten to `submission.count()` over an `EXISTS` semijoin | killed the full in-memory materialisation that was counting via `.length` |
| 2 | `dbQuerySubmissions` re-rooted from `SubmissionVersion` → `Submission` (latest version via `take: 1`) | dropped `distinct`, enabling LIMIT/OFFSET pushdown into the DB |
| 6 | Narrow co-located `siteWorkListingSelect` replacing the shared `submissionVersionForSiteWorkSelect` | removed the `submitted_by` → `User` query entirely; every relation now selects only the columns the formatter reads |
| — | **(this slice)** Composite indexes + `site_id` filter | see below |

### This slice: indexes + `site_id` filter

- Added `@@index([site_id, date_published(sort: Desc), date_created(sort: Desc)])`
  on `Submission` and `@@index([submission_id, status])` on
  `SubmissionVersion` (migration
  [`20260529120000_add_site_works_listing_indexes`](../../prisma/schema/migrations/20260529120000_add_site_works_listing_indexes/migration.sql)).
- `buildListingWhere` now filters `site_id` directly instead of joining `Site`
  by name (the caller already resolved the site via `dbGetSite`), so the
  planner can use the composite index for both the ordered page scan and the
  COUNT, and the `Site` LEFT JOIN disappears from the plan.

**Why a new index rather than reusing `Submission_is_listed_listing_idx`**
(migration `20260526120000`): that index has the exact column order we want but
is partial (`WHERE is_listed = TRUE`). The public endpoint keys on "has a
PUBLISHED version", which is **not** the same predicate — a published work with
an in-progress draft has `is_listed = FALSE` yet must still be listed — so the
partial index is not eligible. The new index is its non-partial twin.

## Current profile (SQL logs, `limit=100`, etl-benchmark)

After 1/2/6 (before this slice's indexes were applied to the DB):

| Query | Time | Note |
| ----- | ---- | ---- |
| `COUNT(*)` semijoin | **683 ms** | biggest single cost; scans all site submissions, can't LIMIT |
| `Submission` page (LIMIT/OFFSET) | **375 ms** | full sort of the site's matching set before LIMIT |
| 5 × relation `IN (100 ids)` (kind, collection, slug, work, version) | ~307 ms each | Prisma default per-relation round trips |
| `WorkVersion IN (...)` | 1.8 ms | nested under versions, cache-warm |

The composite index targets the **375 ms page query** (index range scan in sort
order, short-circuits at LIMIT) and helps the COUNT's `site_id` filter; the
`(submission_id, status)` index makes the `EXISTS` probe index-only. Re-profile
on real data once the migration is applied.

## Remaining work (priority order)

### A. Denormalise the published predicate — kills the COUNT (and the page `EXISTS`)

**Biggest remaining win.** Even with the composite index, `COUNT` must evaluate
the `EXISTS(... status = 'PUBLISHED')` semijoin for every submission on the site
(LIMIT can't apply). A denormalised flag on `Submission` + a partial index turns
the COUNT into an index-only scan and removes the semijoin from the page query
too.

This is the same playbook as
[`submissions-listing-denormalisation.md`](./submissions-listing-denormalisation.md):
extend the existing trigger function `submission_recompute_listing_fields`
(migration `20260526120000`) — it is deliberately generic so new listing
columns extend the body rather than adding triggers.

Two options for the column:

1. **`has_published_version BOOLEAN`** — minimal, exactly matches the public
   listing's default (`status = 'PUBLISHED'`). Partial index:
   ```sql
   CREATE INDEX "Submission_published_listing_idx"
     ON "Submission" (site_id, date_published DESC, date_created DESC)
     WHERE has_published_version = TRUE;
   ```
   The page query adds `where: { has_published_version: true }` and the COUNT
   becomes `count({ where: { site_id, has_published_version: true } })` — no
   semijoin.
2. **`active_status TEXT`** (the column already proposed in the admin-listing
   plan) — reused here. The public endpoint would filter
   `active_status = 'PUBLISHED'`. Slightly broader payoff (one column serves
   both listings) at the cost of coupling the two slices.

**Caveat — the `in-review` branch.** When `status = 'in-review'` *and* a
collection is provided, the listing still needs the `EXISTS(status =
'IN_REVIEW')` path. That branch is rare and always collection-scoped (small
set), so leave it on the semijoin; only the hot PUBLISHED path moves to the
flag. The trigger must recompute the flag on `SubmissionVersion` INSERT/DELETE
and on `status` UPDATE (the existing trigger already fires on exactly these).

**Backfill** mirrors the `is_listed` migration:
```sql
UPDATE "Submission" s
SET has_published_version = EXISTS (
  SELECT 1 FROM "SubmissionVersion" v
  WHERE v.submission_id = s.id AND v.status = 'PUBLISHED'
);
```

Effort: migration + trigger edit + backfill + a `buildListingWhere` change.
Risk: medium (trigger correctness). The regression spec + a new trigger test
lock it.

### B. Collapse the relation fan-out — `relationLoadStrategy: 'join'` + content de-dup

The 5 separate `IN (100 ids)` relation queries are round-trip bound (~307 ms
each, mostly latency — kind/collection return a single row). `findMany({
relationLoadStrategy: 'join' })` folds them into one query via LATERAL joins.

**Caveat (important for payload):** in this dataset every work shares the same
`kind_id` and `collection_id`. A join strategy repeats `kind.content` and
`collection.content` JSON on **every** row, which works against the
minimise-payload goal. Pair the join with de-duping those two relations
(Optimisation 7): fetch the distinct kinds/collections once (they are shared and
small in count) and stitch them in app code, keeping only `kind_id` /
`collection_id` on the row. Net: one round trip for the page + one tiny lookup
for the handful of distinct kinds/collections, with no per-row JSON duplication.

`relationLoadStrategy` is GA-gated in the installed Prisma; confirm it is
enabled (`previewFeatures` / version) before relying on it.

### C. Keyset / cursor pagination for deep offsets

`skip`/`take` (OFFSET) degrades linearly with page depth — the DB still walks
and discards the skipped rows. For deep paging, switch to keyset pagination on
the same sort key `(date_published, date_created, id)` using Prisma `cursor`.
The composite index from this slice already supports the range scan. Only worth
doing if clients page deep; the cache front absorbs shallow paging today.

### D. Cache `dbGetSite` with a short TTL

Every request resolves the site (plus its kinds/collections/domains — visible as
the small queries at the top of the log). A short-TTL LRU cache keyed by
`siteName` removes those per-request lookups for hot sites. Low risk; coordinate
with site-mutation invalidation.

## Tests locking the contract

[`tests/integration/workflow/site-works-listing.spec.ts`](../../platform/scms/tests/integration/workflow/site-works-listing.spec.ts)
— 8 assertions over a deterministic seed (12 published + 2 draft works,
`limit=10` plus a second offset page): envelope shape, counts/pagination, draft
exclusion, ordering by `date_published DESC`, pagination links, exact item DTO
key set, and field mapping for the newest work. All optimisations above must
keep these green.

## References

- [`submissions-listing-denormalisation.md`](./submissions-listing-denormalisation.md)
  — the admin listing's denormalisation slice; shares the trigger function this
  endpoint would extend for (A).
- `Submission.is_listed` (migration
  [`20260526120000`](../../prisma/schema/migrations/20260526120000_add_submission_is_listed/migration.sql))
  — the generic trigger function `submission_recompute_listing_fields`.
- [`20260526204900_add_listing_lookup_indexes`](../../prisma/schema/migrations/20260526204900_add_listing_lookup_indexes/migration.sql)
  — the `IF NOT EXISTS` + Prisma-default-name convention this slice's migration
  follows.
