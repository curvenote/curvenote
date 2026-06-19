# @curvenote/scms-server

## 0.22.0

### Patch Changes

- [#958](https://github.com/curvenote/curvenote/pull/958) [`1ca8aa0`](https://github.com/curvenote/curvenote/commit/1ca8aa083aad3aca0ac922c75dbaa994f2f4fbc9) Thanks [@fwkoch](https://github.com/fwkoch)! - Unpublish on etl re-register

- [#964](https://github.com/curvenote/curvenote/pull/964) [`e8c6279`](https://github.com/curvenote/curvenote/commit/e8c6279b4fd9e194223ffae53b807efade98798d) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Defensive changes on published work lookup for different slug and id shapes

- [#960](https://github.com/curvenote/curvenote/pull/960) [`b344f8b`](https://github.com/curvenote/curvenote/commit/b344f8b6ac8c9ea88fc48906f0774a5b4b979937) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Replace the internal job dispatch transport with **Supabase pgmq** as the single queue (no provider abstraction / mock queue): enqueue via `pgmq.send`, drain via `POST /v1/jobs/push-to-drain`. The enqueue wake is fired by Postgres itself — a `pg_net` `AFTER INSERT` trigger on `pgmq.q_job` calls push-to-drain — so the app does not self-call push-to-drain after enqueue; `pg_cron` remains the 30-second backup. Because the wake comes from the database, `"_JobQueueDrainConfig"` must be populated for jobs to drain promptly.

  Add pgmq **dead-lettering**: when a message's `read_ct` exceeds `MAX_JOB_QUEUE_DELIVERY_ATTEMPTS`, the drain archives it to `pgmq.a_job`, handles the terminal transport failure (including `JOB_FAILED_DEFAULT` cleanup when appropriate), and stops redelivering it, so a poison message can never block the queue.

  Add a **Queues** tab to the **System → Jobs** admin page (`/app/system/jobs?tab=queues`) to manage the drain config without raw SQL: save the drain endpoint, push `api.queueConsumerSecret` into `"_JobQueueDrainConfig"`, see whether the stored secret matches app-config, and view a live tail of pending/in-flight pgmq messages. Backed by `peekJobQueue()` and server helpers (`getJobQueueDrainStatus`, `setJobQueueDrainUrl`, `pushJobQueueDrainSecretFromConfig`, `getJobQueueTail`). The tab also gains a **Drain now** button that processes up to 10 messages in-process (bypassing the `pg_net`/HTTP wake) for manual backlog recovery and testing.

  The local-dev and test database seeds auto-populate `"_JobQueueDrainConfig"` from app-config (`api.url` + `api.queueConsumerSecret`), so `npm run dev:db:reset` / `npm run test:db:reset` no longer require a manual trip to the Queues tab after each reset. The seed realigns the stored secret with app-config while preserving any custom drain url.

  Local development runs the same pgmq + `pg_net` stack as staging/prod. The local Docker Postgres is built from `docker/postgres/Dockerfile` (postgres:16 + pgmq + pg_net + pg_cron), and the dev seed targets `api.tasksCallbackUrl` (`host.docker.internal`) so the `pg_net` enqueue-wake fired inside the container reaches the dev server on the host. The image binds the `pg_net` and `pg_cron` background workers to the `journals` db (`pg_net.database_name` / `cron.database_name`) — without this the workers attach to the default `postgres` db and silently never drain the `journals` queue. **Requires a one-time local rebuild:** `npm run db:rebuild` then `npm run dev:db:reset`.

  `send` honors the dispatch `idempotencyKey` (the `job_id`). Because pgmq has no native idempotency, it skips the enqueue when a message for the same job is already pending or in-flight in `pgmq.q_job`, serialized by a transaction-scoped advisory lock keyed on the job id. This prevents a retried enqueue (e.g. a client retry of `POST /v1/jobs` with the same `id`, where `ensureJobRow` already skipped the insert) from adding a second pgmq message and letting two drains run the same job concurrently.

- Updated dependencies [[`5bf11b9`](https://github.com/curvenote/curvenote/commit/5bf11b9b65b9b623675994a73571b03fa2eeb945)]:
  - @curvenote/scms-core@0.22.0
  - @curvenote/check-definitions@0.16.5
  - @curvenote/scms-db@0.22.0

## 0.21.0

### Patch Changes

- [#945](https://github.com/curvenote/curvenote/pull/945) [`71a32de`](https://github.com/curvenote/curvenote/commit/71a32de6e318642bad1e02cc616d59ef0b51e878) Thanks [@fwkoch](https://github.com/fwkoch)! - Handle re-extracted articles on etl endpoint

- [#948](https://github.com/curvenote/curvenote/pull/948) [`83d0a94`](https://github.com/curvenote/curvenote/commit/83d0a949d5ed4fd693ba9e39af4d1b63230072ed) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Optimizing query on main published article API route

- Updated dependencies [[`0f7463a`](https://github.com/curvenote/curvenote/commit/0f7463a14ad30824def89d97259a1b4289b04baa)]:
  - @curvenote/scms-core@0.21.0
  - @curvenote/scms-db@0.21.0

## 0.20.2

### Patch Changes

- [#938](https://github.com/curvenote/curvenote/pull/938) [`f3f91b8`](https://github.com/curvenote/curvenote/commit/f3f91b80cde2486071abdc21f7f2cdd288526985) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Extend free-text search on the public works listing (`GET /v1/sites/:siteName/works?q=...`) to match affiliation names from `WorkVersion.metadata['frontmatter.myst'].affiliations`.
  - **Index:** add `work_version_affiliations_search_text(metadata)` GIN trigram index on `WorkVersion` via `CREATE INDEX CONCURRENTLY` (large-table safe), extracting each affiliation's `name` (with `institution` fallback).
  - **Query:** add an `OR` branch to `dbSearchSubmissionIds` alongside existing title, author, and DOI predicates; omit the affiliation branch when every query token is a common boilerplate stopword (university, department, school, etc.).
  - **Tests:** integration coverage for Harvard/Wyss-style affiliation metadata; unit tests for the extractor and stopword gate.

  ***

- [#940](https://github.com/curvenote/curvenote/pull/940) [`e871c3d`](https://github.com/curvenote/curvenote/commit/e871c3d918b09180684d732b6fcee245514d9cda) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Speed up site DOI resolution under load (`GET /v1/sites/:siteName/doi/:first/:second`).
  - **Query:** start from btree-backed `WorkVersion.doi` / `Work.doi` equality, join to published `SubmissionVersion` rows scoped by `site_id`, then hydrate the DTO by primary key — avoids Prisma `OR` duplicating `WorkVersion` joins and rooting the plan at `SubmissionVersion`.
  - **Index:** partial `(work_version_id, date_created DESC) WHERE status = 'PUBLISHED'` via `CREATE INDEX CONCURRENTLY` for the latest-published probe after DOI lookup.
  - **Index:** `WorkVersion.work_id` btree (`20260610160000`) so the Work-level DOI fallback probes versions by FK instead of seq-scanning the table.
  - **Query:** Work-level DOI branch uses `work_id IN (SELECT … FROM Work WHERE doi = ?)` so the planner can use `WorkVersion_work_id_idx`.

- [#943](https://github.com/curvenote/curvenote/pull/943) [`202f5b7`](https://github.com/curvenote/curvenote/commit/202f5b7a1b913e64e54e545099d2e1886032708a) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Sites UI improvements

- [#936](https://github.com/curvenote/curvenote/pull/936) [`dc9e4cd`](https://github.com/curvenote/curvenote/commit/dc9e4cded4d91502fa9a09e676adfe7f05655a2c) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Speed up exact subject filtering on the public works listing (`GET /v1/sites/:siteName/works?subject=...`).
  - **Index:** add `work_version_subject_normalized(metadata)` expression index on `WorkVersion` via `CREATE INDEX CONCURRENTLY` (large-table safe) for case- and whitespace-insensitive equality on `metadata['frontmatter.myst'].subject`.
  - **Query:** rewrite `fetchSubmissionIdsBySubject` to start from matching work versions and join back through `SubmissionVersion` (status) to `Submission` (site), instead of scanning every submission on the site with an `EXISTS` subquery that evaluates JSON extraction per row.

- Updated dependencies [[`f3f91b8`](https://github.com/curvenote/curvenote/commit/f3f91b80cde2486071abdc21f7f2cdd288526985), [`bbdb72b`](https://github.com/curvenote/curvenote/commit/bbdb72b024095408a010b97172010ac45fecba36), [`e871c3d`](https://github.com/curvenote/curvenote/commit/e871c3d918b09180684d732b6fcee245514d9cda), [`202f5b7`](https://github.com/curvenote/curvenote/commit/202f5b7a1b913e64e54e545099d2e1886032708a), [`dc9e4cd`](https://github.com/curvenote/curvenote/commit/dc9e4cded4d91502fa9a09e676adfe7f05655a2c), [`e871c3d`](https://github.com/curvenote/curvenote/commit/e871c3d918b09180684d732b6fcee245514d9cda)]:
  - @curvenote/scms-db@0.20.2
  - @curvenote/scms-core@0.20.2

## 0.20.1

### Patch Changes

- [#895](https://github.com/curvenote/curvenote/pull/895) [`ca501fc`](https://github.com/curvenote/curvenote/commit/ca501fc7a5da98692d483db8a5bc98d6f50d4ea2) Thanks [@dependabot](https://github.com/apps/dependabot)! - Uniformly return version on public SiteWork endpoints

- [#926](https://github.com/curvenote/curvenote/pull/926) [`94e9078`](https://github.com/curvenote/curvenote/commit/94e90780c1bd5fdcff575f5c06bacfef4ef26a13) Thanks [@stevejpurves](https://github.com/stevejpurves)! - WorkVersion `subject` read from new frontmatter location

- [#932](https://github.com/curvenote/curvenote/pull/932) [`0594630`](https://github.com/curvenote/curvenote/commit/05946301f9dcf369cef12870ea79022aafb069a8) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Upload form and flow improvements

- [#933](https://github.com/curvenote/curvenote/pull/933) [`8cb7468`](https://github.com/curvenote/curvenote/commit/8cb74684248ba8ad05e8b15d455e475360bf5f89) Thanks [@fwkoch](https://github.com/fwkoch)! - Directly publish on etl endpoint

- Updated dependencies [[`ca501fc`](https://github.com/curvenote/curvenote/commit/ca501fc7a5da98692d483db8a5bc98d6f50d4ea2), [`94e9078`](https://github.com/curvenote/curvenote/commit/94e90780c1bd5fdcff575f5c06bacfef4ef26a13), [`0594630`](https://github.com/curvenote/curvenote/commit/05946301f9dcf369cef12870ea79022aafb069a8)]:
  - @curvenote/common@0.6.1
  - @curvenote/scms-core@0.20.1
  - @curvenote/check-definitions@0.16.3
  - @curvenote/cdn@0.6.1
  - @curvenote/scms-db@0.20.1

## 0.20.0

### Minor Changes

- [#918](https://github.com/curvenote/curvenote/pull/918) [`93b9d35`](https://github.com/curvenote/curvenote/commit/93b9d35d3f9a33b97cbaca5ed6a86baa25ee54c4) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Return a `versions` summary array (submission version id, primary `v{n}` tag, date, and all tags) from the site DOI endpoint (`GET /v1/sites/:site/doi/:first/:second`). This lets clients render version navigation from a single request instead of a follow-up call to the submission `links.versions` listing. Adds a `pickVersionTag` helper and `SiteWorkVersionDTO` type to `@curvenote/common`.

- [#923](https://github.com/curvenote/curvenote/pull/923) [`d3c9203`](https://github.com/curvenote/curvenote/commit/d3c92030cfd718b60d695f7510570a121819499c) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Add optional `subject` to `SiteWorkDTO`, populated from `WorkVersion.metadata['frontmatter.myst'].project.subject`. Exposed on all SiteWork API responses (works listing, DOI resolve, published work get, submission version get/list, previews). Subject is batch-fetched via a Postgres JSON-path query so the full metadata blob is not loaded into Node. The public works listing (`GET /v1/sites/:siteName/works`) accepts a `subject` query param for case-insensitive exact filtering; pagination links preserve it.

### Patch Changes

- [#921](https://github.com/curvenote/curvenote/pull/921) [`260dfd7`](https://github.com/curvenote/curvenote/commit/260dfd72a767833a3c76b3b7b21b0f15b9f61568) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Optimise the site DOI endpoint (`GET /v1/sites/:site/doi/:first/:second`).
  - **Correctness:** the no-tag path is now scoped to the requesting site. Previously it resolved a DOI published on _any_ site, so a DOI could leak a work from a different site; it now 404s like the tag path.
  - **Indexes:** added btree indexes on `Work.doi`, `WorkVersion.doi`, and `SubmissionVersion.work_version_id` (the existing trigram GIN indexes only serve `LIKE`/search, and the FK was unindexed), so DOI equality lookups and the DOI→published-version join no longer sequential-scan.
  - **Query:** unified the tag and no-tag paths into a single `SubmissionVersion`-rooted lookup over a shared `where` builder, letting `ORDER BY date_created DESC` + `LIMIT 1` short-circuit at the first match.
  - **Payload:** a narrower select (`siteWorkDtoSelect`) drops the `submitted_by` → `User` join and the submission-version bookkeeping columns the DTO never reads; `formatSiteWorkDTO` now accepts the narrower `SiteWorkDtoInput` (existing callers pass a structural superset and are unaffected).
  - **Caching:** the route now sets Vercel cache headers — semi-static for successful lookups and a burst-protection preset for 404s — so the CDN absorbs repeat traffic (including DOI-scanner probes) instead of the origin/DB.

- Updated dependencies [[`93b9d35`](https://github.com/curvenote/curvenote/commit/93b9d35d3f9a33b97cbaca5ed6a86baa25ee54c4), [`3546673`](https://github.com/curvenote/curvenote/commit/3546673f19e16c07ac3f229bb5144b54ae9f5548), [`260dfd7`](https://github.com/curvenote/curvenote/commit/260dfd72a767833a3c76b3b7b21b0f15b9f61568), [`d3c9203`](https://github.com/curvenote/curvenote/commit/d3c92030cfd718b60d695f7510570a121819499c)]:
  - @curvenote/common@0.6.0
  - @curvenote/scms-core@0.20.0
  - @curvenote/scms-db@0.20.0
  - @curvenote/cdn@0.6.0
  - @curvenote/check-definitions@0.16.2

## 0.19.1

### Patch Changes

- [#915](https://github.com/curvenote/curvenote/pull/915) [`f7a1741`](https://github.com/curvenote/curvenote/commit/f7a1741c0a6061fae719c6b6dc5808ebf7bbff1f) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Site service account beta

- [#910](https://github.com/curvenote/curvenote/pull/910) [`20a6bea`](https://github.com/curvenote/curvenote/commit/20a6beae8abd86a5ae2c9c22d25435e23157c8df) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Improvements to HMR/DX

- [#910](https://github.com/curvenote/curvenote/pull/910) [`20a6bea`](https://github.com/curvenote/curvenote/commit/20a6beae8abd86a5ae2c9c22d25435e23157c8df) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Rework of submissions listing for better performance over large listings

- Updated dependencies [[`f7a1741`](https://github.com/curvenote/curvenote/commit/f7a1741c0a6061fae719c6b6dc5808ebf7bbff1f), [`b83e516`](https://github.com/curvenote/curvenote/commit/b83e516d5a41f81ddb5ee68d9b03503c48b64c23), [`20a6bea`](https://github.com/curvenote/curvenote/commit/20a6beae8abd86a5ae2c9c22d25435e23157c8df), [`20a6bea`](https://github.com/curvenote/curvenote/commit/20a6beae8abd86a5ae2c9c22d25435e23157c8df)]:
  - @curvenote/scms-core@0.19.1
  - @curvenote/scms-db@0.19.1

## 0.19.0

### Patch Changes

- [#904](https://github.com/curvenote/curvenote/pull/904) [`64a3746`](https://github.com/curvenote/curvenote/commit/64a37464b4883123090e4310c5d6e2a6c69c36b8) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Significant overhaul of the sites UI, and data access patterns. Remove the sites inbox and added a placeholder pending new UI/UX.

- [#901](https://github.com/curvenote/curvenote/pull/901) [`b21ff7d`](https://github.com/curvenote/curvenote/commit/b21ff7d0970dd4b5e5fba64278a014ebdeb39b8f) Thanks [@fwkoch](https://github.com/fwkoch)! - ELT endpoint for work registration

- [#907](https://github.com/curvenote/curvenote/pull/907) [`03834a3`](https://github.com/curvenote/curvenote/commit/03834a326320818fdc071bc0d4ef1e853038f441) Thanks [@stevejpurves](https://github.com/stevejpurves)! - small fix to pagination

- [#893](https://github.com/curvenote/curvenote/pull/893) [`790d919`](https://github.com/curvenote/curvenote/commit/790d919e1d7a8d0ec881eff9c2a5ca03e28732f3) Thanks [@fwkoch](https://github.com/fwkoch)! - Add tags to work and submission version metadata

- [#906](https://github.com/curvenote/curvenote/pull/906) [`3439f63`](https://github.com/curvenote/curvenote/commit/3439f63cb5ae73ee8ac7b7f7c5d8c03783cd34af) Thanks [@fwkoch](https://github.com/fwkoch)! - Remove work tags and canonical from etl

- [#903](https://github.com/curvenote/curvenote/pull/903) [`d9cf56a`](https://github.com/curvenote/curvenote/commit/d9cf56a8c9a40c0d70b56c46e67cde8c91e55714) Thanks [@fwkoch](https://github.com/fwkoch)! - Remove unnecessary extra query with take:4 from etl endpoint

- [#902](https://github.com/curvenote/curvenote/pull/902) [`e3070f2`](https://github.com/curvenote/curvenote/commit/e3070f2cf1a661a23481ab3183e4e8415eda065e) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Minimise db returns bu explicit minimal selects

- Updated dependencies [[`03834a3`](https://github.com/curvenote/curvenote/commit/03834a326320818fdc071bc0d4ef1e853038f441), [`790d919`](https://github.com/curvenote/curvenote/commit/790d919e1d7a8d0ec881eff9c2a5ca03e28732f3)]:
  - @curvenote/scms-core@0.19.0
  - @curvenote/common@0.5.1
  - @curvenote/check-definitions@0.16.1
  - @curvenote/cdn@0.5.1
  - @curvenote/scms-db@0.19.0

## 0.18.0

### Minor Changes

- [#830](https://github.com/curvenote/curvenote/pull/830) [`172c4f1`](https://github.com/curvenote/curvenote/commit/172c4f16d506a785e30071ee4d9f538008790a56) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Introduce `IStorageProvider` with GCS, Azure Blob, and S3 implementations; refactor storage backend and uploads; signed uploads expose `protocol` (`gcs-resumable` | `put`) for browser, tasks, and CLI; add `api.storage` config (legacy GCS keyfile still supported).

### Patch Changes

- [#891](https://github.com/curvenote/curvenote/pull/891) [`3e4de74`](https://github.com/curvenote/curvenote/commit/3e4de74556aaacbec9908bc05eb27d6323261e9f) Thanks [@stevejpurves](https://github.com/stevejpurves)! - By default, draft submissions are not listed

- [#830](https://github.com/curvenote/curvenote/pull/830) [`172c4f1`](https://github.com/curvenote/curvenote/commit/172c4f16d506a785e30071ee4d9f538008790a56) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Works register CLI path and related API routes/loaders; submission listing and version flows; site advanced settings for service accounts and personal access tokens.

- Updated dependencies [[`172c4f1`](https://github.com/curvenote/curvenote/commit/172c4f16d506a785e30071ee4d9f538008790a56), [`172c4f1`](https://github.com/curvenote/curvenote/commit/172c4f16d506a785e30071ee4d9f538008790a56), [`172c4f1`](https://github.com/curvenote/curvenote/commit/172c4f16d506a785e30071ee4d9f538008790a56)]:
  - @curvenote/check-definitions@0.16.0
  - @curvenote/common@0.5.0
  - @curvenote/cdn@0.5.0
  - @curvenote/scms-core@0.18.0
  - @curvenote/scms-db@0.18.0

## 0.17.1

### Patch Changes

- Updated dependencies [[`bfb48cc`](https://github.com/curvenote/curvenote/commit/bfb48cc7ae25d98236e2443dd014c8a887b3b0a0)]:
  - @curvenote/scms-core@0.17.1
  - @curvenote/cdn@0.4.3
  - @curvenote/check-definitions@0.15.2
  - @curvenote/common@0.4.3
  - @curvenote/scms-db@0.17.1

## 0.17.0

### Minor Changes

- [#878](https://github.com/curvenote/curvenote/pull/878) [`8e59ea2`](https://github.com/curvenote/curvenote/commit/8e59ea2a96d2512619a5628aacb62fb7a05fd7fd) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Removed redundant REVIEWER and AUTHOR site roles

- [#878](https://github.com/curvenote/curvenote/pull/878) [`8e59ea2`](https://github.com/curvenote/curvenote/commit/8e59ea2a96d2512619a5628aacb62fb7a05fd7fd) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Adding MEMBER site role and moving SUBMITTER to a more restricted scope set only allowing new submissions and submission updates

- [#875](https://github.com/curvenote/curvenote/pull/875) [`47bd2a2`](https://github.com/curvenote/curvenote/commit/47bd2a24fb02cd16264263f97aeb34f32586df89) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Removal of EDITOR role

### Patch Changes

- Updated dependencies []:
  - @curvenote/scms-core@0.17.0
  - @curvenote/scms-db@0.17.0

## 0.16.3

### Patch Changes

- Updated dependencies []:
  - @curvenote/check-definitions@0.15.1
  - @curvenote/scms-core@0.16.3
  - @curvenote/scms-db@0.16.3

## 0.16.2

### Patch Changes

- [#830](https://github.com/curvenote/curvenote/pull/830) [`d3978f1`](https://github.com/curvenote/curvenote/commit/d3978f16d4b0a839fa3476eec2b90ff2543b01f9) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Removed the `pages` configuration options in favor of a `stringReplacement` dict for term replacement that can work with other dynamic content changes in the client more easily

- Updated dependencies [[`d3978f1`](https://github.com/curvenote/curvenote/commit/d3978f16d4b0a839fa3476eec2b90ff2543b01f9)]:
  - @curvenote/scms-core@0.16.2
  - @curvenote/check-definitions@0.1.3
  - @curvenote/scms-db@0.16.2

## 0.16.1

### Patch Changes

- Updated dependencies [[`cb2bd34`](https://github.com/curvenote/curvenote/commit/cb2bd348a95271abc22fc381277b6b4c3cb0e331)]:
  - @curvenote/scms-core@0.16.1
  - @curvenote/scms-db@0.16.1

## 0.16.0

### Minor Changes

- [#849](https://github.com/curvenote/curvenote/pull/849) [`cce3d6a`](https://github.com/curvenote/curvenote/commit/cce3d6a4a0e99ab266bac9c38405636b867c799a) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Adding the `checks-relay` service and it's supporting packages

- [#859](https://github.com/curvenote/curvenote/pull/859) [`087bb79`](https://github.com/curvenote/curvenote/commit/087bb79435b44d4d166cd8f9904d98845e564adf) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Moving system roles to the database and enabling system admins to update these dynamically. This is a step towards integrating roless into a single consistent RBAC patterns, although further change will be required this step enables manual maigrations and role level feature flag implementation accross all user accounts

### Patch Changes

- [#842](https://github.com/curvenote/curvenote/pull/842) [`d9214cb`](https://github.com/curvenote/curvenote/commit/d9214cb5218657750f6c2f28ecb469cafd54eb0d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Suppress server `Context.trackEvent` for browser GET/HEAD data loads (`Sec-Fetch-Dest: empty`), including React Router single-fetch revalidation and polling-style fetches. Add `EventOptions.forceTrackPolls` to opt back in. Rely on the shared guard from the work layout loader instead of a route-local check.

- [#842](https://github.com/curvenote/curvenote/pull/842) [`d9214cb`](https://github.com/curvenote/curvenote/commit/d9214cb5218657750f6c2f28ecb469cafd54eb0d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Allow setting authors immedately on new drafts

- [#855](https://github.com/curvenote/curvenote/pull/855) [`bbea5b0`](https://github.com/curvenote/curvenote/commit/bbea5b019583bcccaf05a7ea3419c8518be4a236) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Fix malformed `/app//<path>` URLs when navigation item paths are configured with a leading slash. `resolveAccessibleDefaultRoute` now returns nav paths without leading or trailing slashes so the `/app` landing loader can safely concatenate `'/app/' + target`, and `PrimaryNav` normalizes the path the same way when building `NavLink` destinations, so redirects and rendered nav links stay in sync.

- [#841](https://github.com/curvenote/curvenote/pull/841) [`bee3418`](https://github.com/curvenote/curvenote/commit/bee3418d23a820b9d2343fd43332cf19fc71c245) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Add a loopback job for pubsub and dispatch system testing

- [#842](https://github.com/curvenote/curvenote/pull/842) [`d9214cb`](https://github.com/curvenote/curvenote/commit/d9214cb5218657750f6c2f28ecb469cafd54eb0d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Adding defensive early rejection and 404 caching on key routes

- [#853](https://github.com/curvenote/curvenote/pull/853) [`8beebc6`](https://github.com/curvenote/curvenote/commit/8beebc6f48492661fa8585cf3f1f1a9f3d5c81ec) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Restrict iframes and add CSP in report mode

- [#855](https://github.com/curvenote/curvenote/pull/855) [`bbea5b0`](https://github.com/curvenote/curvenote/commit/bbea5b019583bcccaf05a7ea3419c8518be4a236) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Fix `withAppScopedContext` silently redirecting instead of throwing 401 when `{ redirect: true }` is not set.

- [#842](https://github.com/curvenote/curvenote/pull/842) [`1828a5a`](https://github.com/curvenote/curvenote/commit/1828a5a9c59cc081062105a8ef5836a75e9e4b63) Thanks [@github-actions](https://github.com/apps/github-actions)! - Titles for videos are optional

- [#860](https://github.com/curvenote/curvenote/pull/860) [`8d52b54`](https://github.com/curvenote/curvenote/commit/8d52b5486dda7e70cbe65d6e4d68e9186d10907f) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Scope structure and enforcement changes around works

- [#855](https://github.com/curvenote/curvenote/pull/855) [`bbea5b0`](https://github.com/curvenote/curvenote/commit/bbea5b019583bcccaf05a7ea3419c8518be4a236) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Adding finer grains scopes to scms app

- [#855](https://github.com/curvenote/curvenote/pull/855) [`bbea5b0`](https://github.com/curvenote/curvenote/commit/bbea5b019583bcccaf05a7ea3419c8518be4a236) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Allow extensions to expose defined scopes over ServerExtension interface

- Updated dependencies [[`d9214cb`](https://github.com/curvenote/curvenote/commit/d9214cb5218657750f6c2f28ecb469cafd54eb0d), [`a11ab4f`](https://github.com/curvenote/curvenote/commit/a11ab4f3c17518899903d86afa1536b005843d43), [`fa79c02`](https://github.com/curvenote/curvenote/commit/fa79c02ccaf041ab9703638ae6a85e1ec878dfd7), [`6f63f5e`](https://github.com/curvenote/curvenote/commit/6f63f5ec90252a871aa850d1393526692af20c9a), [`bbea5b0`](https://github.com/curvenote/curvenote/commit/bbea5b019583bcccaf05a7ea3419c8518be4a236), [`bee3418`](https://github.com/curvenote/curvenote/commit/bee3418d23a820b9d2343fd43332cf19fc71c245), [`d9214cb`](https://github.com/curvenote/curvenote/commit/d9214cb5218657750f6c2f28ecb469cafd54eb0d), [`cce3d6a`](https://github.com/curvenote/curvenote/commit/cce3d6a4a0e99ab266bac9c38405636b867c799a), [`a3123a4`](https://github.com/curvenote/curvenote/commit/a3123a4efd088d78c28a5a10bbd1f6fb35aca76d), [`087bb79`](https://github.com/curvenote/curvenote/commit/087bb79435b44d4d166cd8f9904d98845e564adf), [`1828a5a`](https://github.com/curvenote/curvenote/commit/1828a5a9c59cc081062105a8ef5836a75e9e4b63), [`8d52b54`](https://github.com/curvenote/curvenote/commit/8d52b5486dda7e70cbe65d6e4d68e9186d10907f), [`bbea5b0`](https://github.com/curvenote/curvenote/commit/bbea5b019583bcccaf05a7ea3419c8518be4a236), [`bbea5b0`](https://github.com/curvenote/curvenote/commit/bbea5b019583bcccaf05a7ea3419c8518be4a236)]:
  - @curvenote/scms-core@0.16.0
  - @curvenote/scms-db@0.16.0

## 0.15.6

### Patch Changes

- [`26a0cf2`](https://github.com/curvenote/curvenote/commit/26a0cf21061b72c8544efcad4add5d8c4f95a309) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Added dispatch endpoints and reorganised backend job handling code

- [#836](https://github.com/curvenote/curvenote/pull/836) [`f9911d7`](https://github.com/curvenote/curvenote/commit/f9911d7a6fac6669d76e46850f2529d4e3280cbe) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Add dispatch endpoints and setup for pubsub

- Updated dependencies []:
  - @curvenote/scms-core@0.15.6
  - @curvenote/scms-db@0.15.6

## 0.15.5

### Patch Changes

- [#828](https://github.com/curvenote/curvenote/pull/828) [`3f9d0ae`](https://github.com/curvenote/curvenote/commit/3f9d0aebde855ab9df12e020f12f01b16a52928d) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Improving the package sent with the analytics.identify call to include roles and scopes. Updating the user via identify when the user's settigns are changed by the platform administrator

- [#831](https://github.com/curvenote/curvenote/pull/831) [`010d781`](https://github.com/curvenote/curvenote/commit/010d7818a46e7265b47ca1959154901ccc79549c) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Moving schemas to central location

- [#814](https://github.com/curvenote/curvenote/pull/814) [`a350156`](https://github.com/curvenote/curvenote/commit/a35015615fa37b752938ea93e02a066584740414) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Adding BlueSky auth provider

- [#803](https://github.com/curvenote/curvenote/pull/803) [`3025543`](https://github.com/curvenote/curvenote/commit/302554357f2233caad98fd9d28dfe7cad82397e1) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Improving links in all slack messages

- Updated dependencies [[`010d781`](https://github.com/curvenote/curvenote/commit/010d7818a46e7265b47ca1959154901ccc79549c), [`a350156`](https://github.com/curvenote/curvenote/commit/a35015615fa37b752938ea93e02a066584740414), [`3025543`](https://github.com/curvenote/curvenote/commit/302554357f2233caad98fd9d28dfe7cad82397e1)]:
  - @curvenote/scms-core@0.15.5
  - @curvenote/scms-db@0.15.5

## 0.15.4

### Patch Changes

- [#825](https://github.com/curvenote/curvenote/pull/825) [`a29cfa7`](https://github.com/curvenote/curvenote/commit/a29cfa7938153ca8979d71e479a7c8821d046a34) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Surface inbound email processing errors and warnings

- [#825](https://github.com/curvenote/curvenote/pull/825) [`a29cfa7`](https://github.com/curvenote/curvenote/commit/a29cfa7938153ca8979d71e479a7c8821d046a34) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Improving content in slack pings to include clickable links

- [#825](https://github.com/curvenote/curvenote/pull/825) [`a29cfa7`](https://github.com/curvenote/curvenote/commit/a29cfa7938153ca8979d71e479a7c8821d046a34) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Show html message bodies for outgoing emails

- [#825](https://github.com/curvenote/curvenote/pull/825) [`a29cfa7`](https://github.com/curvenote/curvenote/commit/a29cfa7938153ca8979d71e479a7c8821d046a34) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Add a slack ping type for inbound emails

- Updated dependencies []:
  - @curvenote/scms-core@0.15.4
  - @curvenote/scms-db@0.15.4

## 0.15.3

### Patch Changes

- [#823](https://github.com/curvenote/curvenote/pull/823) [`2c4308c`](https://github.com/curvenote/curvenote/commit/2c4308c5e40da28044f7528728a09804b4cff166) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Return min client version in v1/config

- [#822](https://github.com/curvenote/curvenote/pull/822) [`6d5955f`](https://github.com/curvenote/curvenote/commit/6d5955f55f20b306703d0a387ae930c9a3c19a69) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Increase min client version to v0.14.2

- Updated dependencies []:
  - @curvenote/scms-core@0.15.3
  - @curvenote/scms-db@0.15.3

## 0.15.2

### Patch Changes

- [#815](https://github.com/curvenote/curvenote/pull/815) [`a968b29`](https://github.com/curvenote/curvenote/commit/a968b2914ea2d7c4590083eb696100d00024cfa1) Thanks [@fwkoch](https://github.com/fwkoch)! - Improve account linking toasts

- [#815](https://github.com/curvenote/curvenote/pull/815) [`a968b29`](https://github.com/curvenote/curvenote/commit/a968b2914ea2d7c4590083eb696100d00024cfa1) Thanks [@fwkoch](https://github.com/fwkoch)! - Invalidate oauth2 cookies

- Updated dependencies [[`0549478`](https://github.com/curvenote/curvenote/commit/0549478873a8ba42f31fda6a013b63c0c156169d), [`f1b4256`](https://github.com/curvenote/curvenote/commit/f1b425684e1f7c8d59c8a584dffe0be562447e6d)]:
  - @curvenote/scms-core@0.15.2
  - @curvenote/scms-db@0.15.2

## 0.15.1

### Patch Changes

- [#807](https://github.com/curvenote/curvenote/pull/807) [`5551b3d`](https://github.com/curvenote/curvenote/commit/5551b3dfb91f565e21eeb09df59a924c65c58297) Thanks [@fwkoch](https://github.com/fwkoch)! - Linking/unlinking toasts

- [#807](https://github.com/curvenote/curvenote/pull/807) [`5551b3d`](https://github.com/curvenote/curvenote/commit/5551b3dfb91f565e21eeb09df59a924c65c58297) Thanks [@fwkoch](https://github.com/fwkoch)! - Allow old token issuers

- Updated dependencies [[`5551b3d`](https://github.com/curvenote/curvenote/commit/5551b3dfb91f565e21eeb09df59a924c65c58297), [`5551b3d`](https://github.com/curvenote/curvenote/commit/5551b3dfb91f565e21eeb09df59a924c65c58297)]:
  - @curvenote/scms-core@0.15.1
  - @curvenote/scms-db@0.15.1

## 0.15.0

### Minor Changes

- [#800](https://github.com/curvenote/curvenote/pull/800) [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Sugnififcant updgrade to support extension checks interfaces and new SCMS Work degigns

### Patch Changes

- [#800](https://github.com/curvenote/curvenote/pull/800) [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Activity feeds for Export to PDF and Start CHECKS; centralized activity type labels
  - **scms-db**: New activity types `EXPORT_TO_PDF_STARTED` and `CHECK_STARTED` (Prisma schema + migration).
  - **scms-server**: `createWorkActivity()` for work-scoped timeline activities.
  - **scms-core**: `ACTIVITY_TYPE_LABELS`, `getActivityTypeLabel()`, and `formatCheckKind()` for shared activity labels; used by sites and platform.
  - **scms-sites-ext**: Activity feed uses `getActivityTypeLabel` from scms-core (removed local `ACTIVITY_TYPES`).
  - **scms**: Work details timeline logs Export to PDF and Check started activities; timeline uses `getActivityTypeLabel` from scms-core.

- [#775](https://github.com/curvenote/curvenote/pull/775) [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72) Thanks [@fwkoch](https://github.com/fwkoch)! - Adding a github oauth2 auth module

- [#800](https://github.com/curvenote/curvenote/pull/800) [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Inlining url signing codde previously provided by @curvenote/cdn

- [#775](https://github.com/curvenote/curvenote/pull/775) [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72) Thanks [@fwkoch](https://github.com/fwkoch)! - Add editor account creation on signup

- [#775](https://github.com/curvenote/curvenote/pull/775) [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72) Thanks [@fwkoch](https://github.com/fwkoch)! - Add signin/signup from submission forms

- [#775](https://github.com/curvenote/curvenote/pull/775) [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72) Thanks [@fwkoch](https://github.com/fwkoch)! - New form UI

- Updated dependencies [[`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72), [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72), [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72), [`e130200`](https://github.com/curvenote/curvenote/commit/e13020083be977f65a7911c608876c06dbdb9d72), [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72), [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72), [`548f272`](https://github.com/curvenote/curvenote/commit/548f272cc3edb0d30a8de810c3f39ad47c0f1a72)]:
  - @curvenote/scms-db@0.15.0
  - @curvenote/scms-core@0.15.0
  - @curvenote/common@0.4.0
  - @curvenote/cdn@0.4.0

## 0.14.4

### Patch Changes

- Updated dependencies []:
  - @curvenote/scms-core@0.14.4
  - @curvenote/scms-db@0.14.4

## 0.14.3

### Patch Changes

- [`34afcc7`](https://github.com/curvenote/curvenote/commit/34afcc7dd6b165f50b0e956b75230dfc1c03e998) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Force package bump because of CI release failure on 0.14.2

- Updated dependencies [[`34afcc7`](https://github.com/curvenote/curvenote/commit/34afcc7dd6b165f50b0e956b75230dfc1c03e998)]:
  - @curvenote/scms-core@0.14.3
  - @curvenote/scms-db@0.14.3

## 0.14.2

### Patch Changes

- Updated dependencies [[`ac62dd3`](https://github.com/curvenote/curvenote/commit/ac62dd3ea84be2609acef0519ea2ba8080a2533c)]:
  - @curvenote/scms-core@0.14.2
  - @curvenote/scms-db@0.14.2

## 0.14.1

### Patch Changes

- [#778](https://github.com/curvenote/curvenote/pull/778) [`89be77d`](https://github.com/curvenote/curvenote/commit/89be77de9d7a3fd47618d24393cd23ff98423aa1) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Simplified the magic link functionality

- [#762](https://github.com/curvenote/curvenote/pull/762) [`d03740b`](https://github.com/curvenote/curvenote/commit/d03740b7eafaa0d457d71c2ab2c019ff27624090) Thanks [@fwkoch](https://github.com/fwkoch)! - 📋 Basic forms for submissions to sites, site admin facing so far.

- [#773](https://github.com/curvenote/curvenote/pull/773) [`e8abe8f`](https://github.com/curvenote/curvenote/commit/e8abe8f1ba10da9b6ea4d8312918b516f216b9d4) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Extend the ExtensionTask interfaces include optional scopes. Implement a function that can retreive available scoped tasks based on app configuration and current user scopes

- Updated dependencies [[`14db863`](https://github.com/curvenote/curvenote/commit/14db86352774df714a757b79be6b14491aaf4f5a), [`d03740b`](https://github.com/curvenote/curvenote/commit/d03740b7eafaa0d457d71c2ab2c019ff27624090), [`e8abe8f`](https://github.com/curvenote/curvenote/commit/e8abe8f1ba10da9b6ea4d8312918b516f216b9d4), [`e8abe8f`](https://github.com/curvenote/curvenote/commit/e8abe8f1ba10da9b6ea4d8312918b516f216b9d4), [`5e288f6`](https://github.com/curvenote/curvenote/commit/5e288f60e542aaf07b6823380199503f14e0e025)]:
  - @curvenote/scms-core@0.14.1
  - @curvenote/scms-db@0.14.1

## 0.14.0

### Minor Changes

- [#769](https://github.com/curvenote/curvenote/pull/769) [`4686252`](https://github.com/curvenote/curvenote/commit/46862529f0af22e6f079f5de177f67ed7bc7bbc0) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Upgrade to Prisma ORM v7

### Patch Changes

- [#769](https://github.com/curvenote/curvenote/pull/769) [`4686252`](https://github.com/curvenote/curvenote/commit/46862529f0af22e6f079f5de177f67ed7bc7bbc0) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Extending app-config.schema to allow database DB certificate to be specified, prisma client functions now accept this string as an optional argument

- Updated dependencies [[`198d139`](https://github.com/curvenote/curvenote/commit/198d1393790a2a259d4c27036611f1117a2bdc94), [`97e5053`](https://github.com/curvenote/curvenote/commit/97e505314971983fe3a4d8c2c5844c7f29bfbed3), [`4686252`](https://github.com/curvenote/curvenote/commit/46862529f0af22e6f079f5de177f67ed7bc7bbc0), [`4686252`](https://github.com/curvenote/curvenote/commit/46862529f0af22e6f079f5de177f67ed7bc7bbc0)]:
  - @curvenote/scms-core@0.14.0
  - @curvenote/scms-db@0.14.0

## 0.13.2

### Patch Changes

- [#764](https://github.com/curvenote/curvenote/pull/764) [`84fbc25`](https://github.com/curvenote/curvenote/commit/84fbc25be6b3b4aab07edb40ebf7a7dfa186c3ba) Thanks [@stevejpurves](https://github.com/stevejpurves)! - Outbound emails not logged as messages and introducing `$schema`s for JSON fields on the `Message` table entries

- [#766](https://github.com/curvenote/curvenote/pull/766) [`33f29c6`](https://github.com/curvenote/curvenote/commit/33f29c6841b1943a8780dde2de1306973db9b79a) Thanks [@github-actions](https://github.com/apps/github-actions)! - Added a configuration "Help" menu item to the primary navigation bar

- Updated dependencies [[`b423ca5`](https://github.com/curvenote/curvenote/commit/b423ca58429a279ce2589038d9fb5ae314893461), [`84fbc25`](https://github.com/curvenote/curvenote/commit/84fbc25be6b3b4aab07edb40ebf7a7dfa186c3ba), [`33f29c6`](https://github.com/curvenote/curvenote/commit/33f29c6841b1943a8780dde2de1306973db9b79a)]:
  - @curvenote/scms-core@0.13.2
