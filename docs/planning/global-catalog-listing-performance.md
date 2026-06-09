# Plan: Global Public Catalog Performance (`/v1/submissions`, `/v1/doi`)

> **Status:** Draft for human / team review (June 2026)  
> **Branch context:** `feat/global-submissions-by-doi` — endpoints landed; performance slice not yet implemented  
> **Related plans:** [site-works-listing-performance.md](./site-works-listing-performance.md), [site-doi-resolve-performance.md](./site-doi-resolve-performance.md), [submissions-listing-denormalisation.md](./submissions-listing-denormalisation.md)

## Summary

The global public catalog adds two endpoints that sit *beside* the existing
site-scoped listing and DOI routes:

| Endpoint | Role |
| -------- | ---- |
| `GET /v1/submissions` | Federated catalog across public, non-external sites |
| `GET /v1/doi/:first/:second` | DOI resolve across that same catalog (`?site=`, `?tag=`) |
| `GET /v1/sites/:siteName/works` | **Unchanged** — single-site archive (keep shared DB layer) |
| `GET /v1/sites/:siteName/doi/...` | **Unchanged** — single-site DOI (keep `sites.doi`) |

Today both global routes reuse the site-works listing DB layer
(`dbListLatestPublishedSubmissions`) or a Prisma variant of the site DOI query.
That was correct for shipping API parity quickly, but it constrains performance
at scale (500k+ submissions), especially for **unfiltered** global listing.

**Decision for this plan:**

1. **Fork bespoke DB access** under `platform/scms/app/routes/api/v1.submissions/`
   (and refine `v1.doi.$first.$second/`) — no DRY requirement with `/works`.
2. **Keep `?site=` / `?sites=`** on `/v1/submissions` (multi-site federation;
   single-site fast path; `/works` remains the canonical single-site route).
3. **Preserve full filter / pagination API parity** with `/works` (see
   [API contract](#api-contract-parity-with-v1sitessitenameworks)).
4. **Phase 1:** bespoke SQL on existing tables (quick wins, no schema change).
5. **Phase 2:** new trigger-maintained read model `PublicCatalogEntry` (scale path).

---

## Endpoints and file map (current)

### `GET /v1/submissions`

| Layer | File |
| ----- | ---- |
| Route / Zod | [`platform/scms/app/routes/api/v1.submissions/route.tsx`](../../platform/scms/app/routes/api/v1.submissions/route.tsx) |
| Orchestration | [`platform/scms/app/routes/api/v1.submissions/db.server.ts`](../../platform/scms/app/routes/api/v1.submissions/db.server.ts) |
| Public site resolution | [`platform/scms/app/routes/api/v1.submissions/public-sites.server.ts`](../../platform/scms/app/routes/api/v1.submissions/public-sites.server.ts) |
| DTO formatting | [`platform/scms/app/routes/api/v1.submissions/format.server.ts`](../../platform/scms/app/routes/api/v1.submissions/format.server.ts) |
| Shared DB (to replace) | [`packages/scms-server/src/backend/loaders/submission-listing/listing-db.server.ts`](../../packages/scms-server/src/backend/loaders/submission-listing/listing-db.server.ts) |

### `GET /v1/doi/:first/:second`

| Layer | File |
| ----- | ---- |
| Route | [`platform/scms/app/routes/api/v1.doi.$first.$second/route.tsx`](../../platform/scms/app/routes/api/v1.doi.$first.$second/route.tsx) |
| Resolve | [`platform/scms/app/routes/api/v1.doi.$first.$second/resolve.server.ts`](../../platform/scms/app/routes/api/v1.doi.$first.$second/resolve.server.ts) |
| Format (shared with submissions) | [`platform/scms/app/routes/api/v1.submissions/format.server.ts`](../../platform/scms/app/routes/api/v1.submissions/format.server.ts) |

### Tests (today)

| Kind | File |
| ---- | ---- |
| Integration (DTO package) | [`platform/scms/tests/integration/workflow/catalog-submissions.spec.ts`](../../platform/scms/tests/integration/workflow/catalog-submissions.spec.ts) |
| E2E smoke | [`platform/scms/tests/e2e/catalog-submissions.spec.ts`](../../platform/scms/tests/e2e/catalog-submissions.spec.ts) |
| Site works golden tests (reference) | [`platform/scms/tests/integration/workflow/site-works-listing.spec.ts`](../../platform/scms/tests/integration/workflow/site-works-listing.spec.ts) |

---

## API contract parity with `/v1/sites/:siteName/works`

The global listing **must** keep the same query parameters and semantics as the
site works listing, **plus** optional site federation.

| Parameter | `/works` | `/submissions` | Notes |
| --------- | -------- | -------------- | ----- |
| `q` | ✅ | ✅ | Min 3 chars; ILIKE substring on title / authors / DOI |
| `subject` | ✅ | ✅ | Exact match, case- and whitespace-insensitive (MyST `subject`) |
| `from` / `to` | ✅ | ✅ | Inclusive ISO `yyyy-mm-dd` on `date_published`; invalid calendar date → 400 |
| `sort` | ✅ | ✅ | `published_desc` (default), `published_asc` |
| `page` / `limit` | ✅ | ✅ | Offset pagination; default `page=0`, `limit=10`; max `limit=500` |
| `total` + `prev`/`next` | ✅ | ✅ | When both `page` and `limit` provided |
| `collection` | ✅ | ✅ | Workflow visibility check for non-published status |
| `kind` | ✅ | ✅ | |
| `status` | ✅ | ✅ | `published` (default) or `in-review`; latter **requires** `collection` |
| `site` / `sites` | — (path param) | ✅ | Optional; omit = all public catalog sites; multi-value supported |

**Response differences (intentional, not regressions):**

- Each catalog item includes `site: { name, title, links }`.
- Each item includes `links.resolve` → global DOI URL with `?site=`.
- Listing envelope `links` has `self` / `prev` / `next` only (no `links.site`).

Performance work changes **implementation only** unless the team explicitly
approves optional contract changes listed in [Open questions](#open-questions-for-team-review).

---

## Why the shared layer is a constraint

`listSubmissionCatalog` calls `dbListLatestPublishedSubmissions(siteIds, …)` —
the same function as `/works`, differing only in `siteIds`:

```ts
// v1.submissions/db.server.ts — today
const dbo = await dbListLatestPublishedSubmissions(siteIds, extensions, ctx.$config, where, opts);

// v1.sites.$siteName.works/db.server.ts — unchanged
const dbo = await dbListLatestPublishedSubmissions([ctx.site.id], extensions, ctx.$config, where, opts);
```

Inherited behaviours that hurt **global** catalog at 500k+:

| Inherited choice | Site `/works` | Global `/submissions` |
| ---------------- | ------------- | --------------------- |
| Root at `Submission` + `versions: { some: PUBLISHED }` | OK with `(site_id, date_published)` index | Semijoin over large cross-site set |
| `site_id IN (...)` when multiple / all public sites | N/A (one site) | Cannot use single index range scan for global sort |
| Search → `id[]` in Node → `id IN (...)` | Costly but bounded per site | Worse across many sites |
| Parallel `COUNT` + `OFFSET` | Acceptable per site | Expensive unfiltered + deep pages |
| Prisma nested `versions take 1` | OK at small limits | Extra relation work per row |

**Indexes today** (see [site-works-listing-performance.md](./site-works-listing-performance.md)):

- `Submission (site_id, date_published DESC, date_created DESC)` — site-prefixed
- `SubmissionVersion (submission_id, status)` — EXISTS probe
- Trgm GIN on `WorkVersion` / `Work` — search only
- DOI btree on `Work.doi`, `WorkVersion.doi` — equality (DOI path)

There is **no** index for “all public sites, ordered globally by `date_published`”.

---

## Target architecture

### Product split (locked)

```
/v1/sites/:site/works     → keep dbListLatestPublishedSubmissions (site-prefixed index)
/v1/submissions           → bespoke catalog listing (this plan)
/v1/sites/:site/doi/...   → keep sites.doi (already optimised — see site-doi plan)
/v1/doi/...               → bespoke catalog DOI (refine in this plan)
```

### Proposed file layout (after fork)

```text
platform/scms/app/routes/api/v1.submissions/
  route.tsx                      # unchanged contract
  db.server.ts                   # orchestration only
  public-sites.server.ts         # site resolution + (later) cached public id list
  catalog-listing.db.server.ts   # NEW — bespoke listing queries
  catalog-listing.types.ts       # NEW — row type for catalog query results
  format.server.ts               # map catalog rows → SubmissionCatalogListingDTO

platform/scms/app/routes/api/v1.doi.$first.$second/
  route.tsx
  resolve.server.ts              # DOI-first SQL (Phase 1); projection lookup (Phase 2)
  # optional: catalog-doi.db.server.ts
```

`/works` does **not** import catalog listing modules.

### Query branching on resolved `siteIds`

Keeping `?site=` enables three planner-friendly modes:

| Mode | When | Strategy |
| ---- | ---- | -------- |
| **Single site** | `siteIds.length === 1` | `site_id = $1` + `(site_id, date_published DESC, …)` index (same cost class as `/works`) |
| **Multi site** | `1 < siteIds.length < allPublic` | `site_id IN (...)` + site-prefixed index bitmap merge |
| **Full catalog** | no `?site=` | Global sort — **requires Phase 2 projection** for 500k scale |

---

## Phase 1 — Bespoke queries on existing tables (no new table)

**Goal:** Own the catalog query plan without schema migration; remove worst patterns.

### 1.1 Replace `dbListLatestPublishedSubmissions` in catalog path

Implement `listCatalogEntries(siteIds, where, opts)` in
`catalog-listing.db.server.ts`:

- Raw SQL or focused Prisma `$queryRaw` — engineer's choice per branch.
- **Single-site branch:** mirror the Submission-rooted plan documented in
  [site-works-listing-performance.md](./site-works-listing-performance.md)
  (proven index use).
- **Multi / full catalog branch:** still correct but not 500k-ready until Phase 2.

### 1.2 Unified search / subject in SQL

Replace two-step `dbSearchSubmissionIds` → `id IN (...)`:

- Single query with `EXISTS` or join predicates in the same statement as the page
  fetch (no materialising large id arrays in Node).
- Keep semantics: `q` min 3 chars; trgm-friendly ILIKE; subject exact match on
  `metadata #>> '{frontmatter.myst,subject}'` (same path as
  [`work-version-subject.server.ts`](../../packages/scms-server/src/backend/work-version-subject.server.ts)).

### 1.3 Formatter adapter

Introduce `CatalogListingRow` in `catalog-listing.types.ts`. Either:

- **Option A (faster ship):** map rows → existing `SubmissionListingRowDBO` at the
  edge so `formatSubmissionCatalogListing` changes minimally.
- **Option B (cleaner):** `formatCatalogItem()` that does not depend on Prisma payload
  shapes.

Still call `fetchWorkVersionSubjects` for `subject` on the page unless Phase 2
denormalises `subject_normalized` onto the projection.

### 1.4 DOI-first resolve (catalog)

Rewrite `resolve.server.ts` to:

1. Resolve `work_version_id`(s) via btree `WorkVersion.doi` / `Work.doi`.
2. Join `SubmissionVersion` where `status = 'PUBLISHED'` and `site_id` in catalog
   site set.
3. `ORDER BY` + `LIMIT 1` (preserve `GLOBAL_DOI_ORDER_BY` semantics for no `?site=`).

**Free win:** remove redundant `dbGetSite()` in `formatDoiResolvedSubmission` when
`resolvePublicCatalogSites` already loaded the site — pass `SiteContext` through.

### 1.5 Tests (Phase 1 gate)

Port golden cases from `site-works-listing.spec.ts` into
`catalog-submissions.spec.ts` with `?site=` where needed:

- `q`, `subject`, `from`/`to`, `sort`, pagination, `collection`/`kind`/`status`
- Multi-site: `?site=a&site=b`
- Reject private site in `?site=` (400)

Run `EXPLAIN (ANALYZE, BUFFERS)` on representative shapes before/after on a large
seed (etl-benchmark or staging).

**Phase 1 does not add `PublicCatalogEntry`.**

---

## Phase 2 — `PublicCatalogEntry` read model (scale path)

**Goal:** O(limit) global catalog listing and fast DOI at 500k+ submissions.

### 2.1 New table: `PublicCatalogEntry`

**Does not exist today.** One row per submission that appears in the public
catalog.

#### Inclusion rule

A row exists iff **all** of:

1. Site is `private = false` AND `external = false`.
2. Submission has **at least one** `SubmissionVersion` with `status = 'PUBLISHED'`.
3. Row represents the **latest published** submission version (same semantics as
   `/works` listing: `versions where status = PUBLISHED order by date_created desc take 1`).

#### Proposed columns

| Column | Type | Purpose |
| ------ | ---- | ------- |
| `submission_id` | `TEXT` PK | |
| `site_id` | `TEXT` NOT NULL | Filter + per-item `site` summary |
| `submission_version_id` | `TEXT` NOT NULL | Listed published version |
| `work_version_id` | `TEXT` NOT NULL | Payload / subject / enrich |
| `date_published` | `TEXT` NOT NULL | Sort + `from`/`to` (from `Submission.date_published`) |
| `date_created` | `TEXT` NOT NULL | Tie-breaker (from `Submission.date_created`) |
| `collection_id` | `TEXT` NOT NULL | Filter |
| `kind_id` | `TEXT` NOT NULL | Filter |
| `collection_name` | `TEXT` NOT NULL | Avoid join in hot path |
| `kind_name` | `TEXT` NOT NULL | Avoid join in hot path |
| `doi` | `TEXT` NULL | `links.resolve` + DOI path |
| `subject_normalized` | `TEXT` NULL | `LOWER(TRIM(metadata…subject))` |
| `search_text` | `TEXT` NULL | Optional: denormalised `title + authors + doi` for `q` |

**Not in v1 of projection:** materialised `in-review` rows — the API supports
`?status=in-review` with `collection` via live query or a follow-up column; default
catalog population is **published-only**.

#### Proposed indexes

```sql
-- Full public catalog (no ?site=)
CREATE INDEX "PublicCatalogEntry_date_published_idx"
  ON "PublicCatalogEntry" (date_published DESC, date_created DESC, submission_id);

-- ?site= single or multi
CREATE INDEX "PublicCatalogEntry_site_date_published_idx"
  ON "PublicCatalogEntry" (site_id, date_published DESC, date_created DESC, submission_id);

-- DOI
CREATE INDEX "PublicCatalogEntry_doi_idx"
  ON "PublicCatalogEntry" (doi) WHERE doi IS NOT NULL;

-- Subject filter
CREATE INDEX "PublicCatalogEntry_subject_normalized_idx"
  ON "PublicCatalogEntry" (subject_normalized) WHERE subject_normalized IS NOT NULL;

-- Optional search
CREATE INDEX "PublicCatalogEntry_search_text_trgm_idx"
  ON "PublicCatalogEntry" USING GIN (search_text gin_trgm_ops);
```

### 2.2 Trigger maintenance

Extend the existing **`submission_recompute_listing_fields`** pattern
(migration [`20260526120000_add_submission_is_listed`](../../prisma/schema/migrations/20260526120000_add_submission_is_listed/migration.sql))
rather than inventing a parallel trigger chain.

#### On `SubmissionVersion` (already fires today)

`AFTER INSERT OR DELETE` and `AFTER UPDATE OF status` → recompute catalog row for
`submission_id`:

| Event | Catalog action |
| ----- | -------------- |
| New / remaining `PUBLISHED` version | **UPSERT** row (latest published version, denormalised fields) |
| Last `PUBLISHED` version gone | **DELETE** row |
| Published v1 + draft v2 on top | **KEEP** row pointing at latest **published** version (same as `/works`) |

#### On `Site` (new — required)

`AFTER UPDATE OF private, external` → recompute all rows for `site_id`:

| Event | Catalog action |
| ----- | -------------- |
| Site becomes `private` or `external` | **DELETE** all `PublicCatalogEntry` for `site_id` |
| Site becomes public and non-external | **BACKFILL** rows for submissions with a published version |

**Underlying `Submission` / `SubmissionVersion` data is never deleted** — only
the catalog projection row.

#### Other recomputes (extend same function or sibling triggers)

- `Submission.date_published` / `date_created` change → update sort keys.
- `WorkVersion` title / authors / doi / metadata subject change → update
  denormalised search/subject/doi fields (trigger on `WorkVersion` or lazy
  refresh — team to choose; document in migration).

### 2.3 Catalog listing reads projection only

`catalog-listing.db.server.ts` queries `PublicCatalogEntry` with filters mapped
1:1 from the [API contract](#api-contract-parity-with-v1sitessitenameworks).

Enrichment query (optional second round trip): load full formatter payload for
`work_version_id` / `submission_version_id` for the page only (~10–50 ids).

### 2.4 Catalog DOI reads projection when possible

- `?site=` set: `SELECT … FROM PublicCatalogEntry WHERE doi = $1 AND site_id = $1 LIMIT 1`.
- No `?site=`: deterministic pick using same ordering as today across matching
  rows (usually 0–2).

### 2.5 Backfill migration

1. `CREATE TABLE PublicCatalogEntry`.
2. `INSERT … SELECT` from live data for all qualifying submissions on public sites.
3. Deploy triggers.
4. Flip catalog routes to projection reads.
5. `EXPLAIN ANALYZE` gate on staging at target row counts.

---

## Lifecycle examples (team review scenarios)

| Scenario | `Submission` table | `PublicCatalogEntry` | Visible on `/v1/submissions` |
| -------- | ------------------ | -------------------- | ---------------------------- |
| Publish first version | unchanged | INSERT | yes |
| Unpublish last published version | unchanged | DELETE | no |
| Publish v2 while v1 stays published | unchanged | UPDATE (points to v2) | yes |
| Add draft on top of published | unchanged | unchanged (still v1 published) | yes |
| Site toggled to `private` | unchanged | DELETE all for site | no |
| Site toggled back to public | unchanged | BACKFILL published rows | yes (republished works) |
| Work on private site | unchanged | never inserted | no (also blocked by `?site=`) |

---

## Caching and operational notes

| Concern | Recommendation |
| ------- | -------------- |
| Public site id list | LRU / `React.cache()` per process — `resolvePublicCatalogSites()` on every request |
| CDN | Keep `SEMI_STATIC_BURST_PROTECTION` on listing; private cache preset on global DOI without `?site=` (already in route) |
| `COUNT` on full catalog | Defer to [open question](#open-questions-for-team-review); expensive at 500k |
| Deep `page` offset | Defer cursor pagination to follow-up unless team wants it in Phase 2 |

---

## Implementation checklist (for agents / engineers)

### Phase 1

- [ ] Add `catalog-listing.db.server.ts` + `catalog-listing.types.ts`
- [ ] Wire `db.server.ts` to bespoke listing (stop importing `dbListLatestPublishedSubmissions`)
- [ ] Branch on `siteIds.length` (single / multi / full)
- [ ] Rewrite catalog DOI resolve (DOI-first SQL)
- [ ] Remove redundant `dbGetSite` in `formatDoiResolvedSubmission`
- [ ] Port filter/pagination tests from `site-works-listing.spec.ts`
- [ ] `EXPLAIN ANALYZE` before/after on staging

### Phase 2

- [ ] Migration: `PublicCatalogEntry` table + indexes
- [ ] Extend `submission_recompute_listing_fields` + `Site` visibility trigger
- [ ] Backfill script in migration
- [ ] Switch `catalog-listing.db.server.ts` to projection reads
- [ ] Switch catalog DOI to projection when `doi` present
- [ ] Re-run golden + e2e + explain gates at 500k-scale seed

### Explicitly out of scope

- Changing `/v1/sites/:siteName/works` query layer
- Changing site-scoped `sites.doi`
- Admin submissions index (`ee/sites/.../submissions._index`) — separate plan in
  [submissions-listing-denormalisation.md](./submissions-listing-denormalisation.md)

---

## Open questions for team review

1. **Phase 2 timing:** Ship Phase 1 first and measure, or go straight to
   `PublicCatalogEntry` if 500k is imminent?

2. **`in-review` on global catalog:** Keep live semijoin for that rare branch, or
   extend projection with `listable_status`?

3. **`total` on unfiltered global listing:** Keep exact `COUNT` (costly), make
   optional (`?include_total=1`), or drop for full-catalog pages?

4. **Cursor pagination:** Add `?cursor=` in Phase 2 alongside `page`/`limit`, or
   separate follow-up?

5. **Search denormalisation:** Store `search_text` on projection vs continue trgm
   on `WorkVersion` with narrower join from projection ids?

6. **`WorkVersion` metadata changes:** Synchronous trigger vs nightly repair job
   for `subject_normalized` / `search_text` drift?

7. **Multi-site `?site=a&site=b`:** Document as supported but recommend `/works`
   for single-site consumers?

---

## References

- Global submissions route registration:
  [`platform/scms/app/routes.ts`](../../platform/scms/app/routes.ts) (`submissions`, `doi/:first/:second`)
- Shared listing DB:
  [`packages/scms-server/src/backend/loaders/submission-listing/listing-db.server.ts`](../../packages/scms-server/src/backend/loaders/submission-listing/listing-db.server.ts)
- Site DOI loader (pattern for unified resolve):
  [`packages/scms-server/src/backend/loaders/sites/doi.server.ts`](../../packages/scms-server/src/backend/loaders/sites/doi.server.ts)
- DTO types:
  [`packages/common/src/types/index.ts`](../../packages/common/src/types/index.ts)
  (`SubmissionCatalogListingDTO`, `DoiResolvedSubmissionDTO`, `CatalogSiteSummaryDTO`)

---

## Execution options (after team approval)

1. **Phase 1 only** — bespoke SQL fork, tests, profile; revisit Phase 2 with data.
2. **Phase 1 + 2 in one programme** — projection migration in same release train
   as catalog query flip.
3. **Phase 2 first** — if schema team capacity exists and 500k is a hard deadline.

Once approved, implementation should use bite-sized PRs: schema → triggers +
backfill → catalog query flip → DOI flip → test port → docs update.
