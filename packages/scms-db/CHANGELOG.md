# @curvenote/scms-db

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
