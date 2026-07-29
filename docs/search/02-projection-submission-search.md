# Projection works search (`SubmissionSearch`)

**Status:** default production path. Active when the kill-switch is **off**:

```bash
# unset, empty, or any value other than true | 1 | on
unset WORKS_SEARCH_PROJECTION_DISABLED
```

Engage the kill-switch (`WORKS_SEARCH_PROJECTION_DISABLED=true`) to fall back to
the [legacy UNION/ILIKE path](./01-legacy-ilike.md).

Source:
`platform/scms/app/routes/api/v1.sites.$siteName.works/db.server.ts`
→ `dbSearchSubmissionIds` (branch where `useSearchProjection()` is true).

---

## Why this path exists

The legacy path probed `WorkVersion` **globally** with `ILIKE`, then filtered by
`site_id` / `status`. On large multi-tenant DBs (hundreds of thousands of work
versions), common author or affiliation terms produced huge candidate sets
before the site join pruned them.

The projection **co-locates** selective keys with searchable text so the site /
status filter is applied **first**, and text matching runs only within that
site’s listed rows.

![Projection vs legacy scoping](./diagrams/projection-vs-legacy-scope.svg)

---

## End-to-end flow

![Projection search request flow](./diagrams/projection-request-flow.svg)

Same outer listing pipeline as legacy (`q` → id set → intersect subject →
Prisma page + count). Only the id-resolution SQL differs. Additionally, when
there is **no** search/subject/collection/kind/date filter, the browse
**total** is counted from the projection
(`dbCountListedFromProjection`) instead of joining `Submission` ⋈
`SubmissionVersion`.

---

## Main query

```sql
SELECT DISTINCT submission_id
FROM "SubmissionSearch"
WHERE site_id = $siteId
  AND status = $status          -- 'PUBLISHED' | 'IN_REVIEW'
  AND (
    search_tsv @@ websearch_to_tsquery('simple', immutable_unaccent($q))
    OR immutable_unaccent($q) <% search_text
  )
```

![Projection query shape](./diagrams/projection-query-tables.svg)

### Match arms

| Arm | Operator | Purpose |
|-----|----------|---------|
| **FTS** | `search_tsv @@ websearch_to_tsquery('simple', …)` | Token / word-gap correct; handles `alice schmeul` → `Alice N. Schmeul` |
| **Fuzzy** | `immutable_unaccent(q) <% search_text` | pg_trgm **word_similarity**; typo / near-match tolerance |

Either arm is enough (`OR`). The query term is passed through
`immutable_unaccent` so accents match the stored columns symmetrically
(`jose muller` ↔ `José Müller`).

Config: `websearch_to_tsquery` accepts a web-search-like syntax (quoted
phrases, `-` negation, `or`) on the **simple** dictionary (no stemming —
good for names / DOIs / titles with scientific tokens).

### Tables touched at query time

| Table / object | Role |
|----------------|------|
| `SubmissionSearch` | Sole table read for id resolution |
| *(functions)* | `immutable_unaccent`, `websearch_to_tsquery` |

**Not read on the hot path:** `WorkVersion`, `Work`, `SubmissionVersion`,
`Submission` (those are only used later for the page payload via Prisma, and
at write time by maintenance triggers).

### Unfiltered browse count

```sql
SELECT COUNT(DISTINCT submission_id) AS count
FROM "SubmissionSearch"
WHERE site_id = $siteId
  AND status = $status
```

Served by btree `SubmissionSearch_site_status_submission_idx` (index-only
friendly). Used only when the projection is active and no
collection / kind / date / search / subject filter applies.

---

## Projection row contents

One row per **listed** submission version (`PUBLISHED` or `IN_REVIEW` only).
Draft / incomplete / etc. are never projected (triggers delete them).

| Column | Meaning |
|--------|---------|
| `submission_version_id` | PK; FK → `SubmissionVersion` (CASCADE) |
| `submission_id` | Listing identity returned by search |
| `site_id` | Tenant scope (leading filter) |
| `status` | Version status (leading filter) |
| `search_text` | Unaccented concatenated searchable string |
| `search_tsv` | `to_tsvector('simple', search_text)` |

### How `search_text` is built

SQL function `submission_search_text(work_version_id)`:

```text
immutable_unaccent(
  concat_ws(' ',
    wv.title,
    immutable_array_to_string(wv.authors, ' '),
    COALESCE(wv.doi, w.doi),
    work_version_affiliations_search_text(wv.metadata)
  )
)
```

Same field coverage as the legacy branches, but **always** including
affiliations (no stopword gate at query time — stopwords only mattered for
whether the legacy affiliation ILIKE branch ran).

---

## Indexes

Migration `20260625120100_add_submission_search_indexes` (`CONCURRENTLY`):

| Index | Type | Serves |
|-------|------|--------|
| `SubmissionSearch_site_status_tsv_idx` | GIN `(site_id, status, search_tsv)` via `btree_gin` | FTS `@@` with site/status |
| `SubmissionSearch_site_status_trgm_idx` | GIN `(site_id, status, search_text gin_trgm_ops)` | `<%` fuzzy with site/status |
| `SubmissionSearch_site_status_submission_idx` | btree `(site_id, status, submission_id)` | Browse `COUNT(DISTINCT …)` |

Leading `site_id` + `status` on the GIN indexes is the key performance design:
one index scan applies scope **and** text match together.

Extensions: `pg_trgm`, `btree_gin`, `unaccent` (plus helpers from earlier
migrations: `immutable_array_to_string`,
`work_version_affiliations_search_text`).

---

## Maintenance (write path)

![Projection trigger maintenance](./diagrams/projection-maintenance.svg)

DDL + triggers: migration `20260625120000_add_submission_search_projection`.

| Event | Effect |
|-------|--------|
| `SubmissionVersion` INSERT / DELETE | Refresh or delete projection row |
| `SubmissionVersion` UPDATE of `status`, `work_version_id`, `submission_id` | Refresh (non-listed statuses → DELETE) |
| `WorkVersion` UPDATE of `title`, `authors`, `doi`, `metadata` | Refresh every SV pointing at that WV |
| `Work` UPDATE of `doi` (when changed) | Refresh SVs for all versions of that work |

Core helper: `submission_search_refresh_sv(sv_id)` — upserts text + tsvector or
deletes if status ∉ `{PUBLISHED, IN_REVIEW}`.

### Rollout / backfill

Split across three migrations so each step holds a short lock:

1. **`…120000`** — DDL (table, functions, triggers)
2. **`…120050`** — idempotent backfill of existing rows
3. **`…120100`** — `CONCURRENTLY` GIN/btree indexes

If the backfill times out: complete via
`prisma/scripts/backfill-submission-search.sql`, then
`prisma migrate resolve --applied …120050` and continue to indexes.

---

## Performance considerations

![Projection performance characteristics](./diagrams/projection-performance.svg)

### What is cheap

- **Site-scoped match** — candidate set is that site’s listed versions only,
  not the global `WorkVersion` heap.
- **Compound GIN** — filter + text match in one index probe (per arm; planner
  may bitmap-or the FTS and trgm indexes).
- **Browse count** from the narrow projection btree instead of a join
  `COUNT(DISTINCT)`.
- After search: count often equals materialised id-set length (same as
  legacy).

### What still costs

1. **Materialise all match ids** — still no `LIMIT` inside
   `dbSearchSubmissionIds`; very broad `q` can return a large id array for
   that site.
2. **Fuzzy arm recall** — `<%` can match more loosely than FTS; combined with
   `OR` it can widen results vs exact substring (by design).
3. **Write amplification** — every listed SV insert/update and WV text change
   refreshes projection row(s). Usually small; bulk WV rewrites touch many
   rows.
4. **Storage** — denormalised text + two GINs + btree per listed version;
   legacy per-column WV trgm indexes remain until a future cleanup once the
   kill-switch is retired (called out in the index migration comments).

### Compared to legacy

| | Projection (default) | Legacy ILIKE |
|--|----------------------|--------------|
| Scope first | Yes — `site_id` + `status` | No — global WV then site |
| Match ops | FTS `@@` **or** `<%` | `ILIKE '%q%'` |
| Accents | `immutable_unaccent` both sides | No |
| Typo / near match | Yes (`<%`) | No |
| Word-gap / tokens | Yes (FTS) | Contiguous substring only |
| Affiliation stopwords | N/A (always in text) | Gate on affiliation branch |
| Hot-path tables | `SubmissionSearch` only | WV ∪ Work → SV → Submission |

---

## Fuzziness / matching semantics

Two complementary matchers:

### Full-text (`@@` + `websearch_to_tsquery('simple', …)`)

| Behaviour | Projection FTS |
|-----------|----------------|
| Case | Folded via tsvector / unaccent pipeline |
| Tokens | Yes — query tokens need not be contiguous |
| Word gaps / middle initials | Yes — `alice schmeul` matches `Alice N. Schmeul` |
| Substring inside a token | No — `cell` does not match `cellular` via FTS alone |
| Stemming | No (`simple` config) |
| Accents | Stripped on store and query |
| Ranking | None in search SQL — listing sort applies later |

### Word similarity (`<%`)

| Behaviour | Projection fuzzy |
|-----------|------------------|
| Basis | pg_trgm **word_similarity** (not plain `ILIKE`) |
| Typos / near spellings | Yes, subject to `pg_trgm.word_similarity_threshold` (Postgres default **0.6** unless overridden) |
| Whole-query vs field | Left side is the (unaccented) query string; right is full `search_text` |
| Combined with FTS | `OR` — fuzzy can admit rows FTS misses and vice versa |

### Field coverage

| Field | In `search_text` / `search_tsv` |
|-------|--------------------------------|
| Title | Yes |
| Authors | Yes |
| DOI (`WorkVersion` or fallback `Work`) | Yes |
| Affiliation names | Yes (always) |
| Abstract / description / full text | **No** |

### Shared route limits

- `q` length &lt; **3** dropped (same as legacy; still relevant for the trgm
  arm).
- Max `q` length 200.

---

## Downstream of search ids

Identical to legacy: intersect with subject ids → `extras.ids` →
`dbQuerySubmissions` + count strategy. See
[01-legacy-ilike.md](./01-legacy-ilike.md#downstream-of-search-ids).

---

## Enabling / verifying

```bash
# Ensure default path (projection on)
unset WORKS_SEARCH_PROJECTION_DISABLED
```

Integration coverage:
`platform/scms/tests/integration/workflow/site-works-listing.spec.ts`
— describe block *“site works listing — search via projection (default)”*:

- middle-initial / word-gap recall
- diacritic-insensitive match
- title / DOI / affiliation tokens
- drafts excluded from projection
- unfiltered browse total via projection count

---

## Related code

| Piece | Location |
|-------|----------|
| Route / `q` schema | `…/v1.sites.$siteName.works/route.tsx` |
| Search + listing + browse count | `…/v1.sites.$siteName.works/db.server.ts` |
| Prisma model | `prisma/schema/submission.prisma` → `SubmissionSearch` |
| DDL + triggers | `prisma/schema/migrations/20260625120000_…` |
| Backfill | `…/20260625120050_…` + `prisma/scripts/backfill-submission-search.sql` |
| Indexes | `…/20260625120100_…` |
| Changelog summary | `platform/scms/CHANGELOG.md` (PR #975) |
| Legacy fallback | [01-legacy-ilike.md](./01-legacy-ilike.md) |
