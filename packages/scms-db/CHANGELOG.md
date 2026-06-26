# @curvenote/scms-db

## 0.22.1

### Patch Changes

- [#973](https://github.com/curvenote/curvenote/pull/973) [`2faf9f0`](https://github.com/curvenote/curvenote/commit/2faf9f02ef08f2e21542f7e88b1af2c4da8084a7) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Tune the Prisma PostgreSQL pool for Vercel function concurrency.

- [#968](https://github.com/curvenote/curvenote/pull/968) [`0e03393`](https://github.com/curvenote/curvenote/commit/0e03393d823fd60a244023c24f4f557e85a00b82) Thanks [@github-actions](https://github.com/apps/github-actions)! - Log PostgreSQL pool errors for production database monitoring.

## 0.22.0

## 0.21.0

## 0.20.2

### Patch Changes

- [#938](https://github.com/curvenote/curvenote/pull/938) [`f3f91b8`](https://github.com/curvenote/curvenote/commit/f3f91b80cde2486071abdc21f7f2cdd288526985) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Extend free-text search on the public works listing (`GET /v1/sites/:siteName/works?q=...`) to match affiliation names from `WorkVersion.metadata['frontmatter.myst'].affiliations`.
  - **Index:** add `work_version_affiliations_search_text(metadata)` GIN trigram index on `WorkVersion` via `CREATE INDEX CONCURRENTLY` (large-table safe), extracting each affiliation's `name` (with `institution` fallback).
  - **Query:** add an `OR` branch to `dbSearchSubmissionIds` alongside existing title, author, and DOI predicates; omit the affiliation branch when every query token is a common boilerplate stopword (university, department, school, etc.).
  - **Tests:** integration coverage for Harvard/Wyss-style affiliation metadata; unit tests for the extractor and stopword gate.

  ***

- [#939](https://github.com/curvenote/curvenote/pull/939) [`bbdb72b`](https://github.com/curvenote/curvenote/commit/bbdb72b024095408a010b97172010ac45fecba36) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Add Supabase advisor btree indexes for FK columns that Postgres does not index automatically (migration `20260610140000_add_db_performance_indexes`, `CREATE INDEX CONCURRENTLY` for large production tables).
  - **Submission** `work_id` — `/my/submissions?work_id=…`, ETL register-work, work teardown
  - **WorkUser** `work_id` — work → `work_users` joins after DOI/work resolution, work teardown
  - **WorkUser** `user_id` — `/my/works`, `/my/submissions` membership filter, `dbGetUserWorkRoles`
  - **SubmissionVersion** `submission_id` — Submission → versions nested-loop joins
  - **Schema** — declare `Work`/`WorkVersion` GIN trgm indexes in Prisma so `migrate dev` does not generate spurious DROP migrations

- [#940](https://github.com/curvenote/curvenote/pull/940) [`e871c3d`](https://github.com/curvenote/curvenote/commit/e871c3d918b09180684d732b6fcee245514d9cda) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Speed up site DOI resolution under load (`GET /v1/sites/:siteName/doi/:first/:second`).
  - **Query:** start from btree-backed `WorkVersion.doi` / `Work.doi` equality, join to published `SubmissionVersion` rows scoped by `site_id`, then hydrate the DTO by primary key — avoids Prisma `OR` duplicating `WorkVersion` joins and rooting the plan at `SubmissionVersion`.
  - **Index:** partial `(work_version_id, date_created DESC) WHERE status = 'PUBLISHED'` via `CREATE INDEX CONCURRENTLY` for the latest-published probe after DOI lookup.
  - **Index:** `WorkVersion.work_id` btree (`20260610160000`) so the Work-level DOI fallback probes versions by FK instead of seq-scanning the table.
  - **Query:** Work-level DOI branch uses `work_id IN (SELECT … FROM Work WHERE doi = ?)` so the planner can use `WorkVersion_work_id_idx`.

- [#936](https://github.com/curvenote/curvenote/pull/936) [`dc9e4cd`](https://github.com/curvenote/curvenote/commit/dc9e4cded4d91502fa9a09e676adfe7f05655a2c) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Speed up exact subject filtering on the public works listing (`GET /v1/sites/:siteName/works?subject=...`).
  - **Index:** add `work_version_subject_normalized(metadata)` expression index on `WorkVersion` via `CREATE INDEX CONCURRENTLY` (large-table safe) for case- and whitespace-insensitive equality on `metadata['frontmatter.myst'].subject`.
  - **Query:** rewrite `fetchSubmissionIdsBySubject` to start from matching work versions and join back through `SubmissionVersion` (status) to `Submission` (site), instead of scanning every submission on the site with an `EXISTS` subquery that evaluates JSON extraction per row.

- [#940](https://github.com/curvenote/curvenote/pull/940) [`e871c3d`](https://github.com/curvenote/curvenote/commit/e871c3d918b09180684d732b6fcee245514d9cda) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Add btree index on `WorkVersion.work_id` (migration `20260610160000_add_work_version_work_id_index`, `CREATE INDEX CONCURRENTLY`) for work-scoped version lookups and Work → versions joins on the large `WorkVersion` table.

## 0.20.1

## 0.20.0

### Patch Changes

- [#921](https://github.com/curvenote/curvenote/pull/921) [`260dfd7`](https://github.com/curvenote/curvenote/commit/260dfd72a767833a3c76b3b7b21b0f15b9f61568) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Optimise the site DOI endpoint (`GET /v1/sites/:site/doi/:first/:second`).
  - **Correctness:** the no-tag path is now scoped to the requesting site. Previously it resolved a DOI published on _any_ site, so a DOI could leak a work from a different site; it now 404s like the tag path.
  - **Indexes:** added btree indexes on `Work.doi`, `WorkVersion.doi`, and `SubmissionVersion.work_version_id` (the existing trigram GIN indexes only serve `LIKE`/search, and the FK was unindexed), so DOI equality lookups and the DOI→published-version join no longer sequential-scan.
  - **Query:** unified the tag and no-tag paths into a single `SubmissionVersion`-rooted lookup over a shared `where` builder, letting `ORDER BY date_created DESC` + `LIMIT 1` short-circuit at the first match.
  - **Payload:** a narrower select (`siteWorkDtoSelect`) drops the `submitted_by` → `User` join and the submission-version bookkeeping columns the DTO never reads; `formatSiteWorkDTO` now accepts the narrower `SiteWorkDtoInput` (existing callers pass a structural superset and are unaffected).
  - **Caching:** the route now sets Vercel cache headers — semi-static for successful lookups and a burst-protection preset for 404s — so the CDN absorbs repeat traffic (including DOI-scanner probes) instead of the origin/DB.

## 0.19.1

## 0.19.0

## 0.18.0

### Minor Changes

- [#830](https://github.com/curvenote/curvenote/pull/830) [`172c4f1`](https://github.com/curvenote/curvenote/commit/172c4f16d506a785e30071ee4d9f538008790a56) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Introduce `IStorageProvider` with GCS, Azure Blob, and S3 implementations; refactor storage backend and uploads; signed uploads expose `protocol` (`gcs-resumable` | `put`) for browser, tasks, and CLI; add `api.storage` config (legacy GCS keyfile still supported).

### Patch Changes

- [#830](https://github.com/curvenote/curvenote/pull/830) [`172c4f1`](https://github.com/curvenote/curvenote/commit/172c4f16d506a785e30071ee4d9f538008790a56) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Works register CLI path and related API routes/loaders; submission listing and version flows; site advanced settings for service accounts and personal access tokens.

## 0.17.1

## 0.17.0

## 0.16.3

## 0.16.2

## 0.16.1

## 0.16.0

## 0.15.6

## 0.15.5

## 0.15.4

## 0.15.3

## 0.15.2

## 0.15.1

## 0.15.0

### Patch Changes

- [#800](https://github.com/curvenote/curvenote/pull/800) [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Activity feeds for Export to PDF and Start CHECKS; centralized activity type labels
  - **scms-db**: New activity types `EXPORT_TO_PDF_STARTED` and `CHECK_STARTED` (Prisma schema + migration).
  - **scms-server**: `createWorkActivity()` for work-scoped timeline activities.
  - **scms-core**: `ACTIVITY_TYPE_LABELS`, `getActivityTypeLabel()`, and `formatCheckKind()` for shared activity labels; used by sites and platform.
  - **scms-sites-ext**: Activity feed uses `getActivityTypeLabel` from scms-core (removed local `ACTIVITY_TYPES`).
  - **scms**: Work details timeline logs Export to PDF and Check started activities; timeline uses `getActivityTypeLabel` from scms-core.

## 0.14.4

## 0.14.3

### Patch Changes

- [`34afcc7`](https://github.com/curvenote/curvenote/commit/34afcc7dd6b165f50b0e956b75230dfc1c03e998) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Force package bump because of CI release failure on 0.14.2

## 0.14.2

## 0.14.1

## 0.14.0

### Minor Changes

- [#769](https://github.com/curvenote/curvenote/pull/769) [`4686252`](https://github.com/curvenote/curvenote/commit/46862529f0af22e6f079f5de177f67ed7bc7bbc0) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Upgrade to Prisma ORM v7

### Patch Changes

- [#769](https://github.com/curvenote/curvenote/pull/769) [`4686252`](https://github.com/curvenote/curvenote/commit/46862529f0af22e6f079f5de177f67ed7bc7bbc0) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Extending app-config.schema to allow database DB certificate to be specified, prisma client functions now accept this string as an optional argument
