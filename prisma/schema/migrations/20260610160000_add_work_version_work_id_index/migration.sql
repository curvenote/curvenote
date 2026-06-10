-- prisma-migrate-disable-next-transaction
-- Supabase advisor: WorkVersion.work_id FK with no implicit Postgres index.
-- Large table — work-scoped version lookups and Work → versions joins were
-- sequential-scanning (work pages, DOI resolution, listings, work teardown).
--
-- CONCURRENTLY on large production tables; IF NOT EXISTS for safe retries.

SET statement_timeout = 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "WorkVersion_work_id_idx"
  ON "WorkVersion" (work_id);
