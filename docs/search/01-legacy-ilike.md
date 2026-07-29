# Legacy works search (UNION / ILIKE)

**Status:** fallback path. Active when the projection kill-switch is engaged:

```bash
WORKS_SEARCH_PROJECTION_DISABLED=true   # also: 1 | on
```

With the kill-switch **off** (default production), this path is not used — see
the projection doc (TBD). This document describes what happens when the
projection is **not** on.

Source:
`platform/scms/app/routes/api/v1.sites.$siteName.works/db.server.ts`
→ `dbSearchSubmissionIds` (branch where `useSearchProjection()` is false).

---

## End-to-end flow

![Legacy search request flow](./diagrams/legacy-request-flow.svg)

1. Route validates `q` (trim, min length 3, max 200).
2. `listPublishedWorks` → `dbListLatestPublishedSubmissions`.
3. If `q` is set, `dbSearchSubmissionIds` returns matching **submission ids**
   (raw SQL).
4. Those ids are intersected with optional subject ids, then passed as
   `extras.ids` into the normal Prisma page query + count.
5. Empty id set short-circuits to `{ items: [], total: 0 }`.

Search never pages inside the ILIKE query: it materialises **all** matching
submission ids for the site/status, then `LIMIT`/`OFFSET` apply on the
subsequent `Submission` listing query.

---

## Main query

Conceptually one statement: a `UNION` of single-predicate `WorkVersion`
branches, then join inward to site-scoped submissions.

![Legacy query shape](./diagrams/legacy-query-tables.svg)

### Pattern construction

```ts
const pattern = `%${escapeIlikePattern(q)}%`;
// escapeIlikePattern only doubles `\`; `%` and `_` in user input remain wildcards
```

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

Appended only when `isAffiliationSearchEnabled(q)` is true (at least one token
≥ 3 chars that is not an affiliation stopword such as `university`, `school`,
`department`, …):

```sql
SELECT wv.id
FROM "WorkVersion" wv
WHERE work_version_affiliations_search_text(wv.metadata) ILIKE $pattern
```

`work_version_affiliations_search_text` extracts
`metadata['frontmatter.myst'].affiliations[*].name` (fallback `institution`)
into a single searchable string (migration
`20260610120000_add_work_version_affiliations_trgm_index`).

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

Migration `20260526223800_add_submission_search_trgm_indexes` (plus affiliations
in `20260610120000`):

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
- Count after search (no collection/kind/date): **id-set length** — no second
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

3. **Four–five index probes per request**  
   UNION runs each branch separately. Latency is roughly the sum of branch
   costs (Postgres may parallelise somewhat, but it is still multiple probes
   + a distinct join).

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

### Compared to the projection path (preview)

| | Legacy ILIKE | Projection (default) |
|--|--------------|----------------------|
| Scope first | No — global WV, then site | Yes — `site_id` + `status` on `SubmissionSearch` |
| Match ops | `ILIKE '%q%'` | FTS `@@` **or** word similarity `<%` |
| Accents | No | `immutable_unaccent` both sides |
| Typo tolerance | No (exact substring) | Yes (`<%`) |
| Intermediate size | All matching WV → site ids | Already site-scoped |

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

From `packages/scms-server/src/backend/work-version-affiliations.server.ts`:
tokens shorter than 3 letters, or in
`AFFILIATION_SEARCH_STOP_TERMS` (`university`, `college`, `department`,
`institute`, `hospital`, `medical`, `school`, …), do not alone enable the
affiliation branch. Title / author / DOI branches still run.

---

## Downstream of search ids

After ids are resolved:

```text
filteredIds = intersect(searchIds, subjectIds?)
extras = { from?, to?, ids: filteredIds }

dbQuerySubmissions(...)   -- Prisma findMany on Submission, take:1 latest version
count:
  filteredIds && !collection/kind/date  →  filteredIds.length
  else                                  →  dbCountSubmissions (join count)
```

---

## Enabling / verifying

```bash
# Engage legacy path (e.g. staging experiment or emergency fallback)
export WORKS_SEARCH_PROJECTION_DISABLED=true
```

Integration coverage:
`platform/scms/tests/integration/workflow/site-works-listing.spec.ts`
— describe block *“site works listing — legacy search (kill-switch) …”*
pins the env var and asserts exact substring semantics on title / author /
DOI (cases that the projection’s fuzzy clause would broaden).

---

## Related code

| Piece | Location |
|-------|----------|
| Route / `q` schema | `…/v1.sites.$siteName.works/route.tsx` |
| Search + listing | `…/v1.sites.$siteName.works/db.server.ts` |
| Affiliation gate + SQL fn name | `packages/scms-server/src/backend/work-version-affiliations.server.ts` |
| Trgm indexes | `prisma/schema/migrations/20260526223800_…` |
| Affiliation index | `prisma/schema/migrations/20260610120000_…` |
| Similar ILIKE pattern (sites UI) | `ee/sites/.../$siteName.submissions._index/db.server.ts` |
