-- prisma-migrate-disable-next-transaction
-- Supabase advisor indexes: FK columns with no implicit Postgres index were
-- forcing nested-loop / sequential scans on work-keyed lookups.
--
-- CONCURRENTLY on large production tables; IF NOT EXISTS for safe retries.

SET statement_timeout = 0;

-- Submission.work_id (~99.98% cost reduction)
-- `/my/submissions?work_id=…`, ETL register-work (`site_id` + `work_id`),
-- work teardown `submission.deleteMany({ work_id })`.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Submission_work_id_idx" ON "Submission" (work_id);

-- WorkUser.work_id (~99.97% cost reduction)
-- Work resolution (e.g. DOI via `Work_doi_idx`) → `work_users` join,
-- `dbGetWorkUsers`, work teardown `workUser.deleteMany({ work_id })`.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "WorkUser_work_id_idx" ON "WorkUser" (work_id);

-- WorkUser.user_id (~28.7% cost reduction)
-- User-scoped work membership (`/my/works`, `/my/submissions` work_users filter,
-- `dbGetUserWorkRoles`).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "WorkUser_user_id_idx" ON "WorkUser" (user_id);

-- SubmissionVersion.submission_id (~99.94% cost reduction, paired with
-- Submission.work_id above). FK join from Submission → versions; composite
-- `(submission_id, …)` indexes exist but a single-column btree is smaller for
-- the nested-loop probe.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SubmissionVersion_submission_id_idx"
  ON "SubmissionVersion" (submission_id);
