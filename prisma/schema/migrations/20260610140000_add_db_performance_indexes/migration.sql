-- Supabase advisor indexes: FK columns with no implicit Postgres index were
-- forcing nested-loop / sequential scans on work-keyed lookups.
--
-- IF NOT EXISTS + Prisma-default names — same convention as listing/DOI migrations.

-- Submission.work_id (~99.98% cost reduction)
-- `/my/submissions?work_id=…`, ETL register-work (`site_id` + `work_id`),
-- work teardown `submission.deleteMany({ work_id })`.
CREATE INDEX IF NOT EXISTS "Submission_work_id_idx" ON "Submission" (work_id);

-- WorkUser.work_id (~99.97% cost reduction)
-- Work resolution (e.g. DOI via `Work_doi_idx`) → `work_users` join,
-- `dbGetWorkUsers`, work teardown `workUser.deleteMany({ work_id })`.
CREATE INDEX IF NOT EXISTS "WorkUser_work_id_idx" ON "WorkUser" (work_id);
