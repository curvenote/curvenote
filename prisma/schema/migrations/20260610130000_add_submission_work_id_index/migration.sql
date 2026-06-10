-- Index powering Submission lookups keyed by work.
--
-- `work_id` is a nullable FK on `Submission` with no implicit Postgres index.
-- Queries that filter on it (e.g. `/my/submissions?work_id=…`, ETL register-work
-- `site_id` + `work_id`, work teardown `deleteMany({ work_id })`) were scanning
-- via `Submission_site_id_idx` or sequential scan. Supabase advisor: ~99.98%
-- cost reduction for the hot path.
--
-- IF NOT EXISTS + Prisma-default name — same convention as listing/DOI migrations.

CREATE INDEX IF NOT EXISTS "Submission_work_id_idx" ON "Submission" (work_id);
