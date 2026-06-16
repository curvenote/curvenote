-- Indexes powering DOI resolution
-- (`GET /v1/sites/:siteName/doi/:first/:second`, handled by `sites.doi` in
-- `packages/scms-server/src/backend/loaders/sites/doi.server.ts`).
--
-- The endpoint resolves a published submission version by equality on the DOI,
-- matching either `WorkVersion.doi` or the underlying `Work.doi`, then joins to
-- the published `SubmissionVersion` for that work version.
--
-- 1/2. Btree on `Work.doi` and `WorkVersion.doi`. The existing
--      `Work_doi_trgm_idx` / `WorkVersion_doi_trgm_idx` (migration
--      20260526223800) are `gin_trgm_ops` indexes that only serve `LIKE`/
--      similarity search — Postgres cannot use them for `doi = ?`, so the
--      equality lookup was a sequential scan.
--
-- 3.   Btree on `SubmissionVersion.work_version_id`. It is a foreign key with
--      no implicit index in Postgres, so the DOI → published-version join (and
--      the `submissionVersions.some` probe) walked it unindexed.
--
-- IF NOT EXISTS guards + Prisma-default index names follow the convention from
-- the listing-lookup migrations: Prisma also declares these from the schema
-- edit, so the migration is robust to whichever side runs first.

CREATE INDEX IF NOT EXISTS "Work_doi_idx" ON "Work" (doi);

CREATE INDEX IF NOT EXISTS "WorkVersion_doi_idx" ON "WorkVersion" (doi);

CREATE INDEX IF NOT EXISTS "SubmissionVersion_work_version_id_idx"
  ON "SubmissionVersion" (work_version_id);
