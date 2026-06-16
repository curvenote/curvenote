-- prisma-migrate-disable-next-transaction
-- Partial index for DOI resolution (`sites.doi` in
-- `packages/scms-server/src/backend/loaders/sites/doi.server.ts`).
--
-- After DOI btree lookup yields work_version_id(s), the hot path probes
-- published submission versions in `date_created DESC` order. A partial index on
-- `status = 'PUBLISHED'` keeps the btree small and matches the join predicate.

SET statement_timeout = 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "SubmissionVersion_published_work_version_date_created_idx"
  ON "SubmissionVersion" (work_version_id, date_created DESC)
  WHERE status = 'PUBLISHED';
