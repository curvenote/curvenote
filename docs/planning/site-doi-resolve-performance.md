# Follow-up Plan: Site DOI Resolution Performance

## Endpoint

`GET /v1/sites/:siteName/doi/:first/:second` — resolves a DOI to the latest
published work on a site (optionally pinned to a version `tag`), returning the
site-work DTO plus an embedded `versions` array.

- Route: [`v1.sites.$siteName.doi.$first.$second.tsx`](../../platform/scms/app/routes/api/v1.sites.$siteName.doi.$first.$second.tsx)
- Loader: [`sites/doi.server.ts`](../../packages/scms-server/src/backend/loaders/sites/doi.server.ts)
- DTO formatter (shared): [`sites/submissions/published/get.server.ts`](../../packages/scms-server/src/backend/loaders/sites/submissions/published/get.server.ts)

A golden-payload regression test locks the delivered DTO (shape, field mapping,
`versions` array, tag path, and the 404 contract) so the optimisation below is
provably behaviour-preserving:
[`tests/integration/workflow/site-doi-resolve.spec.ts`](../../platform/scms/tests/integration/workflow/site-doi-resolve.spec.ts).

## What has landed

| #   | Change                                                                                                         | Effect                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | Btree indexes on `Work.doi`, `WorkVersion.doi`, `SubmissionVersion.work_version_id`                            | DOI equality lookup + the DOI→version join stop sequential-scanning                                      |
| 2   | Unified the tag / no-tag paths into one `SubmissionVersion.findFirst` over a shared `buildPublishedByDoiWhere` | one code path, `date_created DESC` + LIMIT 1 short-circuits at the first match                           |
| 3   | **Correctness:** the no-tag path is now site-scoped                                                            | a DOI published only on _another_ site no longer resolves                                                |
| 4   | Narrow `siteWorkDtoSelect` for this flow                                                                       | drops the `submitted_by` → `User` join and the SubmissionVersion bookkeeping columns the DTO never reads |
| 5   | Edge caching on the route (success + 404)                                                                      | DOI→work mappings and junk-DOI scans are absorbed by the CDN instead of the origin/DB                    |

### 1. Indexes

Migration
[`20260529130000_add_doi_lookup_indexes`](../../prisma/schema/migrations/20260529130000_add_doi_lookup_indexes/migration.sql)
adds btree `@@index([doi])` on `Work` and `WorkVersion`, and
`@@index([work_version_id])` on `SubmissionVersion`.

The pre-existing `Work_doi_trgm_idx` / `WorkVersion_doi_trgm_idx` (migration
`20260526223800`) are `gin_trgm_ops` indexes — they only serve `LIKE`/similarity
search and Postgres cannot use them for `doi = ?`, so the equality lookup was a
seq scan. `SubmissionVersion.work_version_id` is an FK with no implicit index in
Postgres, so the DOI→published-version join walked it unindexed.

### 2/3. Re-root + site-scope

Both branches now build their filter from one function:

```ts
function buildPublishedByDoiWhere(siteName, doiNormalized, tag?) {
  return {
    status: 'PUBLISHED',
    submission: { site: { name: siteName } },
    ...(tag ? { tags: { has: tag } } : {}),
    OR: [
      { work_version: { doi: doiNormalized } },
      { work_version: { work: { doi: doiNormalized } } },
    ],
  };
}
```

The old no-tag path rooted at `WorkVersion.findMany` **without** a site filter,
so it could return a work published on a different site (the tag path already
scoped correctly). Rooting at `SubmissionVersion` makes the two paths identical
apart from the tag predicate and folds the previous "newest work version → its
newest published submission version" two-step into a single
"newest published submission version" ordering.

> Note: the ordering semantics shift from _newest WorkVersion_ to _newest
> published SubmissionVersion_. For the common single-version work these are the
> same; the SubmissionVersion ordering matches the tag path and the embedded
> `versions` array, so the response is internally consistent.

### 4. Narrow select

`siteWorkDtoSelect` (in
[`prisma.selects.server.ts`](../../packages/scms-server/src/backend/prisma.selects.server.ts))
keeps the same relation shape as the shared `submissionVersionForSiteWorkSelect`
— so the nested kind/collection summary formatters still type-check — but drops
the SubmissionVersion-level columns `formatSiteWorkDTO` never reads (`status`,
`transition`, `job_id`, `work_version_id`, version-level `date_*`) and, most
importantly, `submitted_by`, which otherwise pulls a whole `User` row.

`formatSiteWorkDTO`'s parameter type was relaxed from the broad `DBO` to a new
`SiteWorkDtoInput` derived from the narrow select. The broad payload is a
structural superset, so the other callers (`published/get`, `versions/get`,
`previews/get`) that pass a wider row still satisfy it unchanged.

### 5. Edge caching

The route ([`v1.sites.$siteName.doi.$first.$second.tsx`](../../platform/scms/app/routes/api/v1.sites.$siteName.doi.$first.$second.tsx))
previously returned a bare `Response.json(dto)` with no cache directives — every
hit, including scanner traffic probing unknown DOIs, reached the origin/DB. It
now applies the same `vercelCacheHeaders` pattern as the works listing and the
`published/` endpoint:

- **Success:** `SEMI_STATIC_BURST_PROTECTION` (public sites) / `PRIVATE_CACHE_OPTIONS`
  (private sites). A DOI→work mapping is stable and identical for every caller.
- **404:** `sites.doi` signals not-found by throwing a 404 `Response`, so the
  loader catches it and re-emits with `NOT_FOUND_PUBLIC_BURST` headers — the
  preset written for "unknown work / junk path segments from scans" — preserving
  the original body and `statusText` (the distinct 404 messages the e2e asserts).

**Freshness cost:** a newly published DOI may 404 (or a just-superseded version
may resolve) at the edge until the TTL lapses (`s-maxage` 60s success / 300s
404, with `stale-while-revalidate`). Tune the presets if DOI propagation needs
to be faster.

> Not verified against a live server — the SCMS API was not running locally and
> e2e needs a populated fixture DB. The change is lint-clean and mirrors the
> established pattern in `published.tsx` and the thumbnail/social routes; the
> package-level integration spec is route-independent and still green.

## Remaining / optional work

### A. Narrow the shared site-work formatter further

`formatSiteWorkDTO` still receives full `kind` / `collection` / `work` /
`slugs` relations because the shared summary formatters
(`formatSubmissionKindSummaryDTO`, `formatCollectionSummaryDTO`) are typed to the
full models. The works-listing endpoint solved this by copying a local formatter
with a narrow input type. Doing the same here (or relaxing the summary
formatters to structural inputs) would let `siteWorkDtoSelect` select only the
summary columns (`kind {id,name,content,default}`, `collection
{id,name,slug,workflow,content,open}`, `work {doi,key}`, primary slug only).
Low payoff for a single-row endpoint; medium blast radius. Defer.

### B. Single round trip for the `versions` array

The endpoint issues a second query (`dbGetPublishedVersionsForSubmission`) for
the version list. It is small and indexed by `(submission_id, date_created)`, so
it is cheap; only worth folding in if profiling shows the extra round trip
matters.

## Tests locking the contract

- [`tests/integration/workflow/site-doi-resolve.spec.ts`](../../platform/scms/tests/integration/workflow/site-doi-resolve.spec.ts)
  — 7 assertions over a deterministic seed: DTO + `versions` shape, full field
  mapping, multi-version ordering (newest resolved + array newest-first), the
  tag path (hit + miss 404), the **cross-site 404** (the intended behaviour
  change — this test fails on the pre-rewrite code), and the invalid / unknown
  DOI 404 messages.
- [`tests/e2e/sites.doi.spec.ts`](../../platform/scms/tests/e2e/sites.doi.spec.ts)
  — added `find work by doi, incorrect site` asserting `sites/newscience/doi/...`
  404s against the fixture work that lives on `science`. The prior cross-site
  test there targeted the `published/` endpoint, so the `doi/` path's
  site-scoping was previously uncovered end-to-end.

## References

- [`site-works-listing-performance.md`](./site-works-listing-performance.md)
  — sibling endpoint; the narrow-select / local-formatter pattern referenced in
  (A).
- [`20260526204900_add_listing_lookup_indexes`](../../prisma/schema/migrations/20260526204900_add_listing_lookup_indexes/migration.sql)
  — the `IF NOT EXISTS` + Prisma-default-name convention this migration follows.
