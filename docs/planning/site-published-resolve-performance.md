# Follow-up Plan: Site Published Work Resolution Performance

## Endpoint

`GET /v1/sites/:siteName/works/:workIdOrSlug/published` — resolves a work id or
slug to the latest published submission version on a site, returning the site-work
DTO plus an embedded `versions` array.

- Route: [`v1.sites.$siteName.works.$workIdOrSlug.published/route.tsx`](../../platform/scms/app/routes/api/v1.sites.$siteName.works.$workIdOrSlug.published/route.tsx)
- Loader: [`sites/submissions/published/get.server.ts`](../../packages/scms-server/src/backend/loaders/sites/submissions/published/get.server.ts)
- Shared resolver: [`sites/submissions/published/resolve.server.ts`](../../packages/scms-server/src/backend/loaders/sites/submissions/published/resolve.server.ts)

Theme article pages call this on every render via
[`apps/theme/lib/loaders.server.ts`](../../../next-theme/apps/theme/lib/loaders.server.ts)
(`getPublishedWork`). Thumbnail and social routes reuse the same resolver for the
published hot path.

Golden-payload regression tests lock the delivered DTO and site-scoping contract:
[`tests/integration/workflow/site-doi-resolve.spec.ts`](../../platform/scms/tests/integration/workflow/site-doi-resolve.spec.ts).

## What has landed

| #   | Change                                                                                              | Effect                                                                                          |
| --- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Shared `resolve.server.ts` with index-native raw SQL (work id vs slug branches)                     | Avoids Prisma `OR`, duplicate joins, and `Site.name` filter                                     |
| 2   | Hydrate via `findUnique` + `siteWorkDtoSelect` (published/social) or `publishedThumbnailSelect`     | Drops `submitted_by` User join and unused SubmissionVersion columns on hot paths                |
| 3   | **Correctness:** resolve scoped by `Submission.site_id`                                             | A work published only on another site returns null (404 at route)                               |
| 4   | `dbGetPublishedVersionsForSubmission` uses `site_id` + `submission_id` instead of `Site.name` join  | Cheaper versions array query                                                                    |
| 5   | Partial index `SubmissionVersion_published_submission_date_created_idx` (`20260612150000`)          | Backs `ORDER BY date_created DESC` for published versions on a submission                       |
| 6   | Route moved to folder layout under `works/`                                                         | Matches nested `works/route.tsx` registration pattern                                           |
| 7   | Edge caching unchanged on route (`SEMI_STATIC_BURST_PROTECTION` / `NOT_FOUND_PUBLIC_BURST`)         | DOI and published share stable CDN semantics for success + junk 404s                            |

### 1. Resolver paths

**Work id** (`looksLikeUUID`):

```sql
WorkVersion.work_id = ?
  → SubmissionVersion (status = PUBLISHED)
  → Submission (site_id = ?)
ORDER BY sv.date_created DESC LIMIT 1
```

Uses `WorkVersion_work_id_idx` and
`SubmissionVersion_published_work_version_date_created_idx` (migration
`20260610150000`, shared with DOI resolve).

**Slug**:

```sql
Slug (slug, site_id)
  → Submission (site_id = ?)
  → SubmissionVersion (status = PUBLISHED)
ORDER BY sv.date_created DESC LIMIT 1
```

Uses `Slug @@unique([slug, site_id])`.

### 2. Shared vs divergent callers

| Caller              | Phase 1 (resolve)              | Phase 2 (hydrate select)        |
| ------------------- | ------------------------------ | ------------------------------- |
| `published.get`     | `fetchPublishedSubmissionVersionId` | `siteWorkDtoSelect`        |
| `thumbnail` (pub)   | same                           | `publishedThumbnailSelect`      |
| `social` (pub)      | same                           | `siteWorkDtoSelect`             |
| `thumbnail` (draft) | legacy Prisma path             | `submissionVersionForSiteWorkSelect` (cold path) |

DOI resolve keeps its own resolver in `doi.server.ts` but shares formatters
(`formatPublishedSiteWorkWithVersions`, `siteWorkDtoSelect`).

### 3. Versions partial index

Migration
[`20260612150000_add_published_versions_hot_path_index`](../../prisma/schema/migrations/20260612150000_add_published_versions_hot_path_index/migration.sql):

```sql
CREATE INDEX CONCURRENTLY … ON "SubmissionVersion" (submission_id, date_created DESC)
  WHERE status = 'PUBLISHED';
```

## Remaining / optional work

### A. Narrow the shared site-work formatter further

Same as DOI plan — low payoff unless profiling shows relation bloat.

### B. Runtime cache (LRU / Vercel Runtime Cache)

Edge cache already covers public sites. Per-request `React.cache()` dedup helps
only when multiple loaders hit published in one request (thumbnail + social on
same page are separate HTTP calls).

### C. Thumbnail unpublished fallback

Still uses legacy `findFirst` + `Site.name` + broad select. Optimize only if
preview traffic shows up in advisor.

### D. Hostname lookup (`GET /v1/sites?hostname=`)

Separate theme hot path — see theme SCMS optimization backlog.

## Verification

```bash
npm run lint
npm run test:integration -- platform/scms/tests/integration/workflow/site-doi-resolve.spec.ts
```

Apply migration in staging/production before expecting index-backed plans in
Supabase Query Performance Advisor.
