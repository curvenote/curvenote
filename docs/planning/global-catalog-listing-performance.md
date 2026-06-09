# Plan: Global Public Catalog Performance (`/v1/submissions`, `/v1/doi`)

> **Status:** Draft for human / team review (June 2026)  
> **Branch context:** `feat/global-submissions-by-doi` — endpoints landed; performance slice not yet implemented  
> **Related plans:** [site-works-listing-performance.md](./site-works-listing-performance.md), [site-doi-resolve-performance.md](./site-doi-resolve-performance.md), [submissions-listing-denormalisation.md](./submissions-listing-denormalisation.md)

## Rollout principle — assess Phase 1 first

**Phase 1 is expected to be already performant** for our current deployment shape
(a handful of public sites — e.g. three — and submission counts well below the
500k stress case). It should be **implemented and measured before committing to
Phase 2**.

| Phase | When | Why |
| ----- | ---- | --- |
| **Phase 1** (bespoke SQL, **no new table**) | **Do this first** | Forks catalog queries off the shared `/works` layer, fixes the worst patterns (two-phase search, DOI resolve shape), and keeps full API parity. With few sites, `?site=` single-site and small multi-site federation stay on the same `(site_id, date_published)` index path as `/works` — not materially slower in practice. |
| **Phase 2** (`PublicCatalogEntry` + triggers) | **Only if Phase 1 measurement says so** | Needed for **unfiltered global listing at very large scale** (500k+ submissions). Higher operational cost (multiple triggers, backfill, drift tests). Do not jump here preemptively. |

**Phase 1 gate (before Phase 2 planning locks):**

1. Ship bespoke `catalog-listing.db.server.ts` + DOI-first resolve.
2. Run `EXPLAIN (ANALYZE, BUFFERS)` on staging for: no `?site=`, `?site=one`, `?site=a&site=b`, plus `q` / `subject` / paginated shapes.
3. Compare p95 to site-scoped `/works` on the same site and data volume.
4. Proceed to Phase 2 only if unfiltered global listing or `COUNT` at target row counts fails SLOs — or if 500k is on a fixed near-term roadmap.

Phase 2 remains fully specified in this document for team review, but it is a
**follow-up scale path**, not a prerequisite for launching the catalog API.

---

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
That was correct for shipping API parity quickly. It becomes a constraint mainly
at **very large scale** (500k+ submissions), especially for **unfiltered** global
listing — the problem Phase 2 solves. Phase 1 addresses code ownership and
moderate optimisations without schema change.

**Decision for this plan:**

1. **Fork bespoke DB access** under `platform/scms/app/routes/api/v1.submissions/`
   (and refine `v1.doi.$first.$second/`) — no DRY requirement with `/works`.
2. **Keep `?site=` / `?sites=`** on `/v1/submissions` (multi-site federation;
   single-site fast path; `/works` remains the canonical single-site route).
3. **Preserve full filter / pagination API parity** with `/works` (see
   [API contract](#api-contract-parity-with-v1sitessitenameworks)).
4. **Phase 1 first:** bespoke SQL on existing tables — ship, profile, **assess**
   (see [Rollout principle](#rollout-principle--assess-phase-1-first)).
5. **Phase 2 if needed:** new trigger-maintained read model `PublicCatalogEntry`
   (scale path), kept correct by **multiple triggers** (not only
   `SubmissionVersion`) — see [§2.2](#22-trigger-maintenance--multiple-triggers-required)
   and [edge cases](#edge-cases-and-correctness-matrix).

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

### 2.2 Trigger maintenance — **multiple triggers required**

> **Review highlight:** A single trigger on `SubmissionVersion` is **not
> sufficient**. Catalog visibility depends on facts spread across **Site**,
> **Submission**, **SubmissionVersion**, **WorkVersion**, and **Work**. If we
> only extend the existing `SubmissionVersion` trigger (as `is_listed` does),
> the projection will **drift** when site visibility, sort keys, DOI, or search
> fields change without a version status transition.

Follow the existing *pattern* from
[`20260526120000_add_submission_is_listed`](../../prisma/schema/migrations/20260526120000_add_submission_is_listed/migration.sql)
— one idempotent recompute **function** per `submission_id` (or per `site_id`
for bulk site visibility) — but attach it via **multiple triggers** on different
tables. Name the catalog function distinctly, e.g.
`public_catalog_recompute_for_submission(submission_id)`, and call it from each
trigger site below.

#### Why one trigger is not enough (failure modes)

| Change | Fires `SubmissionVersion` trigger? | Without other triggers |
| ------ | ---------------------------------- | ---------------------- |
| Site `private: false → true` | ❌ | Stale rows remain in catalog |
| Site `external: true → false` | ❌ | Missing rows until manual backfill |
| `Submission.date_published` updated | ❌ | Wrong global sort order |
| `WorkVersion.doi` / title / authors edited | ❌ | Stale `doi`, `search_text`, `links.resolve` |
| `Work.doi` set (version DOI null) | ❌ | DOI resolve / `links.resolve` wrong |
| `Submission.kind_id` / `collection_id` changed | ❌ | Wrong `?kind=` / `?collection=` membership |
| `Submission.site_id` changed (if ever allowed) | ❌ | Row under wrong site or orphaned |
| ETL / admin SQL updates metadata | ❌ | Subject / search drift |

#### Required trigger inventory

| # | Table | Trigger timing | Columns / events | Action |
| - | ----- | -------------- | ---------------- | ------ |
| **T1** | `SubmissionVersion` | `AFTER INSERT OR DELETE`; `AFTER UPDATE OF status` | Same as `is_listed` today | `public_catalog_recompute_for_submission(submission_id)` — UPSERT if a published version remains, else DELETE |
| **T2** | `Site` | `AFTER UPDATE OF private, external` | `WHEN (OLD.private IS DISTINCT FROM NEW.private OR OLD.external IS DISTINCT FROM NEW.external)` | Site became catalog-eligible → **backfill** all qualifying submissions on site; became ineligible → **DELETE** all rows for `site_id` |
| **T3** | `Submission` | `AFTER UPDATE OF date_published, date_created, kind_id, collection_id`; `AFTER UPDATE OF site_id` if moves are possible | Sort + filter columns | Recompute row if still catalog-eligible |
| **T4** | `Submission` | `AFTER DELETE` | Submission removed | **DELETE** catalog row |
| **T5** | `WorkVersion` | `AFTER UPDATE OF title, authors, doi, metadata, work_id` | Denormalised display + search | Recompute all catalog rows whose `submission_version_id` points at this WV (usually one; handle version promotion) |
| **T6** | `Work` | `AFTER UPDATE OF doi` | Work-level DOI fallback | Recompute catalog rows for submissions whose listed published version uses this work |

**T1 + T2 are mandatory for correctness.** T3–T6 are mandatory if denormalised
columns (`date_published`, `doi`, `search_text`, `subject_normalized`, kind/collection
names) live on `PublicCatalogEntry` — which they should for the performance goal.

Optional **T7** (team decision): `AFTER INSERT ON Submission` — usually a no-op
until a published version exists (T1 handles that), but documents intent.

#### T1 — `SubmissionVersion` (published predicate)

| Event | Catalog action |
| ----- | -------------- |
| First `PUBLISHED` version created | **INSERT** row (latest published SV + denormalised fields) |
| Newer `PUBLISHED` version supersedes older | **UPDATE** `submission_version_id`, `work_version_id`, denormalised fields |
| Last `PUBLISHED` version → `UNPUBLISHED` / `RETRACTED` / `IN_REVIEW` / deleted | **DELETE** row (if no other `PUBLISHED` version remains) |
| `PUBLISHED` v1 + `DRAFT` / `INCOMPLETE` v2 on top | **UNCHANGED** — still points at v1 published (same as `/works`; differs from `is_listed`) |
| `PUBLISHED` v1 + newer `PUBLISHED` v2 | **UPDATE** to v2 |

Statuses that remove the row when **no** published version remains include at
minimum: `UNPUBLISHED`, `RETRACTED`, and version **DELETE**. Any transition away
from `PUBLISHED` on the *last* published version must re-run the “any published
left?” probe.

#### T2 — `Site` (visibility predicate) — **cannot be folded into T1**

| Event | Catalog action |
| ----- | -------------- |
| `private → true` or `external → true` | **DELETE** all `PublicCatalogEntry WHERE site_id = …` |
| `private → false` and `external → false` | **BACKFILL** — insert rows for every submission on site with a published version |
| Site already private; submission published | No row (T1 may run but function must check site eligibility and no-op / delete) |

Every T1 recompute **must** guard: `Site.private = false AND Site.external = false`
before INSERT/UPSERT. That makes T1 alone safe on private sites, but **does not**
remove existing rows when the **site** flips — only T2 does that in bulk.

#### T3–T6 — denormalised field freshness

Without these, the API contract (search, subject, sort, DOI links) can lie while
status stays `PUBLISHED`. Prefer **synchronous** triggers in the write transaction;
a nightly repair job is a **supplement**, not a substitute (document repair query
in runbook for drift detection).

#### Shared recompute function contract

```sql
-- Conceptual — one function, many callers
public_catalog_recompute_for_submission(p_submission_id TEXT) RETURNS void
```

Must be **idempotent**: call N times → same row state. Steps:

1. Load submission + site; if site not catalog-eligible → DELETE row; return.
2. Find latest `SubmissionVersion` where `status = 'PUBLISHED'` (order `date_created DESC`).
3. If none → DELETE row; return.
4. Resolve denormalised fields from linked `WorkVersion` / `Work` / `Submission`.
5. INSERT … ON CONFLICT (submission_id) DO UPDATE.

Bulk helper for T2:

```sql
public_catalog_backfill_for_site(p_site_id TEXT) RETURNS void
public_catalog_purge_for_site(p_site_id TEXT) RETURNS void  -- DELETE all rows
```

#### Testing triggers (Phase 2 gate)

Integration tests must cover **each trigger path independently** — not only
“publish then list”. See [Edge cases matrix](#edge-cases-and-correctness-matrix).

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

## Edge cases and correctness matrix

Use this table in team review and as the acceptance checklist for Phase 2
trigger tests. “Visible” means appears in default `?status=published` listing
(ignoring `?site=` filter for clarity).

### Visibility and site eligibility

| # | Scenario | Expected catalog row | Trigger(s) |
| - | -------- | -------------------- | ---------- |
| E1 | First publish on public site | INSERT | T1 |
| E2 | Publish on private site | No row | T1 (guard deletes / skips) |
| E3 | Site `private: false → true` with published works | DELETE all for site | **T2** |
| E4 | Site `private: true → false` with published works | BACKFILL | **T2** |
| E5 | Site `external: false → true` | DELETE all for site | **T2** |
| E6 | Site `external: true → false` | BACKFILL | **T2** |
| E7 | `?site=private-name` on API | 400 (no query) | app layer |
| E8 | Submission on public site, then site made private mid-session | Row gone after T2 | **T2** |

### Published version lifecycle

| # | Scenario | Expected catalog row | Trigger(s) |
| - | -------- | -------------------- | ---------- |
| E9 | Last published version unpublished | DELETE | T1 |
| E10 | Published version **deleted** (no published left) | DELETE | T1 |
| E11 | Published → `RETRACTED` (last published) | DELETE | T1 |
| E12 | Two published versions; newer unpublished, older still published | Row points at **older** published | T1 |
| E13 | Two published versions; v2 published after v1 | Row points at **v2** | T1 |
| E14 | Published v1 + `DRAFT` / `INCOMPLETE` v2 | Row still v1 published | T1 |
| E15 | `date_published` NULL on submission | Row excluded from date-filtered queries; sort behaviour matches `/works` (NULL sorts out of `from`/`to`) | T3 |
| E16 | `Submission.date_published` corrected after publish | Row sort key updates | **T3** |
| E17 | Submission deleted entirely | DELETE | **T4** |

### Kind, collection, and `in-review` API branch

| # | Scenario | Expected behaviour | Notes |
| - | -------- | ------------------ | ----- |
| E18 | `?kind=` filter | Uses denormalised `kind_name` on row | T3 on kind change |
| E19 | `?collection=` + `?status=in-review` | Live query or extended projection — **not** default published row | See open questions; default projection is published-only |
| E20 | Collection workflow hides `IN_REVIEW` for listing | Empty list for that filter (same as today) | App/workflow layer |
| E21 | `kind_id` / `collection_id` changed on submission | Row filter columns update | **T3** |

### Work / version metadata (DOI, search, subject)

| # | Scenario | Expected catalogue / API | Trigger(s) |
| - | -------- | ------------------------ | ---------- |
| E22 | DOI only on `Work`, not `WorkVersion` | Row `doi` = work DOI; resolve works | **T6** / T5 |
| E23 | DOI added to `WorkVersion` after publish | Row + `links.resolve` update | **T5** |
| E24 | DOI changed on published work | Old DOI gone from index; new DOI indexed | **T5** / **T6** |
| E25 | Same DOI on two public sites | Two rows; global `/v1/doi` picks deterministic winner (newest `date_published`) | T1; DOI query |
| E26 | Same DOI on two sites; `?site=` on DOI | Site-scoped resolve | app layer |
| E27 | Title / authors change on listed `WorkVersion` | `?q=` matches new text after recompute | **T5** |
| E28 | MyST `subject` in metadata changed | `?subject=` + response `subject` update | **T5** |
| E29 | New `WorkVersion` created but not yet on a published SV | No catalog change until publish | T1 only on publish |

### API / pagination edge cases (Phase 1 + 2)

| # | Scenario | Expected behaviour |
| - | -------- | ------------------ |
| E30 | `?site=a&site=b` (multi-site) | Union of eligible rows; both sites’ published works |
| E31 | Omit `?site=` | All public non-external sites |
| E32 | `q` shorter than 3 chars | Ignored (not error) |
| E33 | Invalid `from` / `to` date | 400 |
| E34 | `?status=in-review` without `?collection=` | 400 |
| E35 | Deep `page` + large `limit` | Correct but slow without cursor pagination (known) |
| E36 | Empty catalog (no public sites / no published works) | `{ items: [], total: 0 }` |

### Operational and drift edge cases

| # | Scenario | Mitigation |
| - | -------- | ---------- |
| E37 | ETL / `register-work` publishes without app code | T1 fires on `SubmissionVersion` INSERT — covered if DB write path used |
| E38 | Raw SQL admin fix on `WorkVersion` | **T5** must fire; runbook repair if bypassed |
| E39 | Backfill migration interrupted | Re-run idempotent backfill; compare counts vs live query |
| E40 | Trigger throws mid-transaction | Publish transaction rolls back — catalog stays consistent |
| E41 | `is_listed = false` but published version exists | **Still listed** in catalog (same as `/works`; `is_listed` ≠ published predicate) |

---

## Lifecycle examples (quick reference)

| Scenario | `Submission` data | `PublicCatalogEntry` | Visible |
| -------- | ----------------- | -------------------- | ------- |
| Publish first version | unchanged | INSERT (T1) | yes |
| Unpublish last published version | unchanged | DELETE (T1) | no |
| Publish v2 while v1 stays published | unchanged | UPDATE → v2 (T1) | yes |
| Add draft on top of published | unchanged | unchanged (T1) | yes |
| Site toggled to `private` | unchanged | DELETE all (T2) | no |
| Site toggled back to public | unchanged | BACKFILL (T2) | yes |
| DOI edited on published work | unchanged | UPDATE doi (T5/T6) | yes, new DOI |
| Work on private site | unchanged | never inserted | no |

**Underlying `Submission` / `SubmissionVersion` / `Work` rows are never deleted by
catalog maintenance** — only `PublicCatalogEntry` projection rows are inserted,
updated, or deleted.

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
- [ ] Implement `public_catalog_recompute_for_submission` + site backfill/purge helpers
- [ ] Attach **all required triggers T1–T6** (see [§2.2](#22-trigger-maintenance--multiple-triggers-required)); do not ship with T1 only
- [ ] Integration test per trigger path (matrix rows E1–E41)
- [ ] Backfill script in migration + count reconciliation query
- [ ] Switch `catalog-listing.db.server.ts` to projection reads
- [ ] Switch catalog DOI to projection when `doi` present
- [ ] Re-run golden + e2e + explain gates at 500k-scale seed
- [ ] Runbook: repair job for metadata drift if T5/T6 bypassed in admin ops

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

6. **`WorkVersion` / `Work` triggers (T5/T6):** Confirm synchronous triggers on
   every metadata write path; agree nightly repair as safety net only.

7. **Multi-site `?site=a&site=b`:** Document as supported but recommend `/works`
   for single-site consumers?

8. **`Submission.site_id` moves:** Are they possible in production? If yes, T3
   must handle; if no, document as invariant.

9. **Trigger consolidation:** Single PL/pgSQL function vs separate per-table
   functions — preference for maintainability?

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

**Default (recommended):** **Phase 1 only** → measure → decide on Phase 2.

1. **Phase 1 only** *(recommended first step)* — bespoke SQL fork, tests,
   `EXPLAIN ANALYZE` + p95 vs `/works`; revisit Phase 2 only if SLOs fail or
   500k is imminent.
2. **Phase 1 then 2** — second programme after Phase 1 assessment documents the
   gap (typical if unfiltered global listing at 500k is required).
3. **Phase 1 + 2 in one programme** — only if measurement is impossible on
   staging and 500k is a hard near-term deadline (higher risk; not default).

Once approved, implementation should use bite-sized PRs:

1. Schema + recompute functions  
2. **Triggers T1–T6** (separate PR acceptable per table if each ships with tests)  
3. Backfill + reconciliation  
4. Catalog query flip → DOI flip → test port → docs update  

**Do not** flip catalog reads to `PublicCatalogEntry` until T1 **and** T2 at
minimum are live — otherwise site visibility changes will leave stale or missing
rows.
