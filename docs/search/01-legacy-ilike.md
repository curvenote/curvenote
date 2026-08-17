# Legacy works search (UNION / ILIKE)

**Status:** fallback path. Active when the projection kill-switch is engaged:

```bash
WORKS_SEARCH_PROJECTION_DISABLED=true   # also: 1 | on
```

With the kill-switch **off** (default production), this path is not used — see
[02-projection-submission-search.md](./02-projection-submission-search.md).
This document describes what happens when the projection is **not** on.

**Primary source:**
[`db.server.ts`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/db.server.ts)
→ [`dbSearchSubmissionIds`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/db.server.ts)
(branch where [`useSearchProjection()`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/db.server.ts)
is false).

---

## End-to-end flow

![Legacy search request flow](./diagrams/legacy-request-flow.svg)

### One query or many?

**Multiple round-trips.** We do **not** load all site submissions first.

For a typical `?q=…&page=0&limit=10` request (no `subject` / collection / kind /
date):

| # | Step | DB? | Returns |
|---|------|-----|---------|
| 1 | Search id resolution | **Yes — 1 raw SQL** | `string[]` of **all** matching submission ids (unpaged) |
| 2 | Page load | **Yes — Prisma `findMany`** | Only the **current page** of submission rows (+ nested latest version) |
| 3 | Total | **No** (in-memory) | `searchIds.length` |

So: **ids for every match**, then **rows for one page**. Never “SELECT every
submission on the site, then filter in Node.”

With extra filters you may add more queries (subject, collection lookup, join
count). Details below.

### Step-by-step

#### 1. HTTP route — parse & validate

[`route.tsx` `loader`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/route.tsx)

- Reads query params; Zod schema drops `q` when trimmed length &lt; 3 (max 200).
- Resolves site context (`withSecureSiteContext`); external sites short-circuit
  to `{ items: [], total: 0, links: {} }` with **no** listing/search queries.
- **Returns (in-process):** `where` (`q`, `subject`, dates, …) +
  `{ page, limit, sort }`.
- Calls [`listPublishedWorks`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/db.server.ts).

#### 2. Orchestrator — `listPublishedWorks` → `dbListLatestPublishedSubmissions`

[`listPublishedWorks`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/db.server.ts)
/
[`dbListLatestPublishedSubmissions`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/db.server.ts)

- Maps API `status` → DB (`published` → `PUBLISHED`, etc.).
- Coordinates the id-resolution queries, intersection, page query, count, then
  formatting.
- **Final return (HTTP body):** `SiteWorkListingDTO`
  (`{ items, total, links, … }` via
  [`format.server.ts`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/format.server.ts)).

#### 3. Q1 — search: ids only (not full submissions)

[`dbSearchSubmissionIds`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/db.server.ts)
(legacy branch)

- **One** `$queryRaw` statement: `UNION` of `WorkVersion` `ILIKE` branches,
  then join to `SubmissionVersion` + `Submission` for `status` + `site_id`.
- **Returns:** `Promise<string[]>` — **every** matching `Submission.id` for
  that site/status. **No `LIMIT` / `OFFSET`.**
- Does **not** return titles, authors, or version rows — ids only.
- Does **not** start from “all submissions on the site”; it starts from
  globally matching work versions, then joins down to this site’s submissions
  (see [Main query](#main-query)).

If `q` is absent, this step is skipped (`searchIds` stays `undefined`).

#### 4. Q2? — optional subject ids

Only when `subject=` is set:
[`fetchSubmissionIdsBySubject`](../../packages/scms-server/src/backend/work-version-subject.server.ts)

- **Returns:** another `string[]` of submission ids.
- Then
  [`intersectSubmissionIds`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/db.server.ts)
  intersects search ∩ subject **in memory**.
- Empty intersection → `{ items: [], total: 0 }` with **no** page query.

#### 5. Optional collection gate

If `collection=` is set: Prisma `collection.findFirst` (visibility check). May
return empty without running the listing queries.

#### 6. Q3 (+ Q4?) — page of rows + total (parallel)

When offset pagination is requested (`page` / `limit` present — the public
route always passes them):

```ts
Promise.all([
  dbQuerySubmissions(...),  // page
  countPromise,             // total
])
```

**Page — [`dbQuerySubmissions`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/db.server.ts)**

- Prisma `submission.findMany` with
  [`buildListingWhere`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/db.server.ts):
  `site_id`, optional collection/kind/date, and **`id: { in: filteredIds }`**
  when search/subject ran.
- `orderBy` publication date; `skip` / `take` for the page.
- Nested `versions: { where: { status }, take: 1, … }` for the latest matching
  version.
- **Returns:** `RowDBO[]` — **only this page** (e.g. 10 rows), not the full
  match set.

**Count**

| Situation | What runs | Returns |
|-----------|-----------|---------|
| Search/subject ids resolved, no collection/kind/date | **In-memory** `filteredIds.length` | `number` (no DB) |
| Otherwise | [`dbCountSubmissions`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/db.server.ts) raw `COUNT(DISTINCT s.id)` with same filters | `number` |

(The projection browse-count shortcut is **not** used on this kill-switch
path.)

#### 7. Format + subjects for DTO

[`formatSiteWorkDTOFromSubmissions`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/format.server.ts);
may also call
[`fetchWorkVersionSubjects`](../../packages/scms-server/src/backend/work-version-subject.server.ts)
for the page’s work-version ids (another small query) before JSON response.

### Mental model

```text
q present?
  └─ Q1: raw SQL → ALL matching submission ids[]     (wide, ids only)
subject?
  └─ Q2: raw SQL → subject ids[] → intersect in RAM
empty ids? → { items: [], total: 0 }
else:
  ├─ Q3: Prisma page WHERE id IN (ids) LIMIT/OFFSET  (narrow, full rows)
  └─ total: len(ids)  or  Q4 count query
→ format → JSON
```

---

## Main query

Conceptually **one** SQL statement per search (Q1): a `UNION` of
single-predicate `WorkVersion` branches, then join inward to site-scoped
submissions. (Postgres may execute UNION arms as separate plans; from the app
it is still a single round-trip.)

![Legacy query shape](./diagrams/legacy-query-tables.svg)

### Pattern construction

```ts
const pattern = `%${escapeIlikePattern(q)}%`;
// escapeIlikePattern only doubles `\`; `%` and `_` in user input remain wildcards
```

See
[`escapeIlikePattern`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/db.server.ts)
in `db.server.ts`.

### Branch A–D (always)

```sql
-- A. title
SELECT wv.id FROM "WorkVersion" wv
WHERE wv.title ILIKE $pattern

-- B. work-version DOI
SELECT wv.id FROM "WorkVersion" wv
WHERE wv.doi ILIKE $pattern

-- C. authors (text[] → space-joined string; expression must match the GIN index)
SELECT wv.id FROM "WorkVersion" wv
WHERE immutable_array_to_string(wv.authors, ' ') ILIKE $pattern

-- D. work-level DOI
SELECT wv.id
FROM "WorkVersion" wv
INNER JOIN "Work" w ON w.id = wv.work_id
WHERE w.doi ILIKE $pattern
```

### Branch E (conditional — affiliations)

Appended only when
[`isAffiliationSearchEnabled(q)`](../../packages/scms-server/src/backend/work-version-affiliations.server.ts)
is true (at least one token ≥ 3 chars that is not an affiliation stopword such
as `university`, `school`, `department`, …):

```sql
SELECT wv.id
FROM "WorkVersion" wv
WHERE work_version_affiliations_search_text(wv.metadata) ILIKE $pattern
```

`work_version_affiliations_search_text` extracts
`metadata['frontmatter.myst'].affiliations[*].name` (fallback `institution`)
into a single searchable string (migration
[`20260610120000_add_work_version_affiliations_trgm_index`](../../prisma/schema/migrations/20260610120000_add_work_version_affiliations_trgm_index/migration.sql)).

### Outer join (site + status scope)

```sql
SELECT DISTINCT s.id
FROM (
  /* UNION of branches A–D [+ E] */
) matching_wv
INNER JOIN "SubmissionVersion" sv
  ON sv.work_version_id = matching_wv.id
 AND sv.status = $status          -- 'PUBLISHED' | 'IN_REVIEW'
INNER JOIN "Submission" s
  ON s.id = sv.submission_id
 AND s.site_id = $siteId
```

### Tables touched

| Table / object | Role |
|----------------|------|
| `WorkVersion` | Primary search root (title, doi, authors, metadata) |
| `Work` | Work-level DOI (branch D) |
| `SubmissionVersion` | Restrict to versions in the requested status |
| `Submission` | Restrict to the requesting site; emit submission ids |
| *(functions)* | `immutable_array_to_string`, `work_version_affiliations_search_text` |

**Not used on this path:** `SubmissionSearch` projection table.

---

## Indexes (pg_trgm GIN)

Migrations
[`20260526223800_add_submission_search_trgm_indexes`](../../prisma/schema/migrations/20260526223800_add_submission_search_trgm_indexes/migration.sql)
and
[`20260610120000_add_work_version_affiliations_trgm_index`](../../prisma/schema/migrations/20260610120000_add_work_version_affiliations_trgm_index/migration.sql):

| Index | Expression / column |
|-------|---------------------|
| `WorkVersion_title_trgm_idx` | `title gin_trgm_ops` |
| `WorkVersion_doi_trgm_idx` | `doi gin_trgm_ops` |
| `WorkVersion_authors_trgm_idx` | `(immutable_array_to_string(authors, ' ')) gin_trgm_ops` |
| `Work_doi_trgm_idx` | `Work.doi gin_trgm_ops` |
| `WorkVersion_affiliations_trgm_idx` | `(work_version_affiliations_search_text(metadata)) gin_trgm_ops` WHERE `metadata IS NOT NULL` |

Each UNION branch is a **single** `ILIKE` predicate so the planner can use the
matching GIN index (bitmap index scan) instead of a sequential scan of
`WorkVersion`. Combining several `OR`ed ILIKEs in one scan historically
defeated that plan; UNION keeps each branch indexable.

`%` and `_` left unescaped in user input are intentional wildcards (same
contract as the submissions-index search).

---

## Performance considerations

![Legacy performance characteristics](./diagrams/legacy-performance.svg)

### What is cheap

- Per-branch trigram GIN lookups for selective `q` (≥ 3 chars, uncommon
  substrings).
- Subsequent listing page: `Submission` ordered by `date_published` with
  `id IN (...)`, served by the site listing indexes when the id set is
  moderate.
- Count after search (no collection/kind/date): **id-set length** — no extra
  DB count round-trip.

### What is expensive / risky

1. **Global search, then site filter**  
   Each branch scans for matches across **all** `WorkVersion` rows in the
   database, then joins to `SubmissionVersion` / `Submission` for
   `site_id` + `status`. On multi-tenant / large corpora, most ILIKE hits may
   belong to other sites and are discarded after the join.

2. **Materialise all match ids**  
   There is no `LIMIT` inside `dbSearchSubmissionIds`. A broad `q` (e.g.
   common tokens that still clear the affiliation stopword gate, or deliberate
   `%`-style wildcards in input) can return a very large id array into the
   Node process and into `WHERE id IN (...)`.

3. **Four–five index probes per search statement**  
   UNION runs each branch separately. Latency is roughly the sum of branch
   costs (Postgres may parallelise somewhat, but it is still multiple probes
   + a distinct join) inside **one** client round-trip.

4. **Affiliation branch selectivity**  
   Stopwords avoid probing affiliations for queries like `university` alone.
   Queries with one significant token still enable the branch and can widen
   the result set.

5. **Short / noisy patterns**  
   Route drops `q` with length &lt; 3. Patterns that remain very common still
   produce large bitmap results from pg_trgm.

6. **No unaccent / normalisation**  
   Unlike the projection path, matching is on stored text as-is (case folded
   by `ILIKE` only). Accented vs ASCII variants do not match unless the
   stored value happens to contain the typed form.

### Compared to the projection path

| | Legacy ILIKE | Projection (default) |
|--|--------------|----------------------|
| Scope first | No — global WV, then site | Yes — `site_id` + `status` on `SubmissionSearch` |
| Match ops | `ILIKE '%q%'` | FTS `@@` **or** word similarity `<%` |
| Accents | No | `immutable_unaccent` both sides |
| Typo tolerance | No (exact substring) | Yes (`<%`) |
| Intermediate size | All matching WV → site ids | Already site-scoped |

Full projection write-up:
[02-projection-submission-search.md](./02-projection-submission-search.md).

---

## Fuzziness / matching semantics

This path is **not fuzzy** in the typo-tolerant sense. “Fuzzy” here only
refers to Postgres **trigram indexes** accelerating substring predicates —
matching itself is **case-insensitive exact substring** (`ILIKE`).

| Behaviour | Legacy ILIKE |
|-----------|--------------|
| Case | Insensitive (`ILIKE`) |
| Substring | Yes — `q` may match anywhere in the field |
| Word boundaries | No — `cell` matches `cellular`, `ancellary`, … |
| Typos / edit distance | No — `schmeul` will not match `schmoul` |
| Token / gap (middle initials) | No — `alice schmeul` will not match `alice n. schmeul` unless that exact contiguous substring exists |
| Accents | No normalisation |
| User `%` / `_` | Treated as SQL wildcards |
| Ranking | None in the search SQL — order comes from the later listing sort (`published_desc` / `published_asc`) |

### Field coverage

| Field | Matched |
|-------|---------|
| Title | Yes |
| Authors (`text[]`) | Yes (space-joined) |
| WorkVersion DOI | Yes |
| Work DOI | Yes |
| Affiliation names | Yes, if stopword gate passes |
| Abstract / description / full text | **No** |

### Affiliation stopwords

From
[`work-version-affiliations.server.ts`](../../packages/scms-server/src/backend/work-version-affiliations.server.ts):
tokens shorter than 3 letters, or in `AFFILIATION_SEARCH_STOP_TERMS`
(`university`, `college`, `department`, `institute`, `hospital`, `medical`,
`school`, …), do not alone enable the affiliation branch. Title / author / DOI
branches still run.

---

## Enabling / verifying

```bash
# Engage legacy path (e.g. staging experiment or emergency fallback)
export WORKS_SEARCH_PROJECTION_DISABLED=true
```

Integration coverage:
[`site-works-listing.spec.ts`](../../platform/scms/tests/integration/workflow/site-works-listing.spec.ts)
— describe block *“site works listing — legacy search (kill-switch) …”*
pins the env var and asserts exact substring semantics on title / author /
DOI (cases that the projection’s fuzzy clause would broaden).

---

## Related code

| Piece | Link |
|-------|------|
| Route / `q` schema | [`route.tsx`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/route.tsx) |
| Search + listing orchestration | [`db.server.ts`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/db.server.ts) |
| DTO formatting | [`format.server.ts`](../../platform/scms/app/routes/api/v1.sites.$siteName.works/format.server.ts) |
| Affiliation gate + SQL fn name | [`work-version-affiliations.server.ts`](../../packages/scms-server/src/backend/work-version-affiliations.server.ts) |
| Subject id lookup | [`work-version-subject.server.ts`](../../packages/scms-server/src/backend/work-version-subject.server.ts) |
| Trgm indexes | [`20260526223800_…/migration.sql`](../../prisma/schema/migrations/20260526223800_add_submission_search_trgm_indexes/migration.sql) |
| Affiliation index | [`20260610120000_…/migration.sql`](../../prisma/schema/migrations/20260610120000_add_work_version_affiliations_trgm_index/migration.sql) |
| Integration tests | [`site-works-listing.spec.ts`](../../platform/scms/tests/integration/workflow/site-works-listing.spec.ts) |
| Similar ILIKE pattern (sites UI) | [`ee/sites/…/db.server.ts`](../../ee/sites/src/routes/$siteName.submissions._index/db.server.ts) |
