-- prisma-migrate-disable-next-transaction
-- Partial index for published work resolve versions list
-- (`dbGetPublishedVersionsForSubmission` in
-- `packages/scms-server/src/backend/loaders/sites/submissions/published/get.server.ts`).
--
-- After resolving the latest published submission version, the handler loads all
-- published versions for the same submission ordered by `date_created DESC`. A
-- partial index on `status = 'PUBLISHED'` keeps the btree small and matches the
-- filter predicate.

SET statement_timeout = 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "SubmissionVersion_published_submission_date_created_idx"
  ON "SubmissionVersion" (submission_id, date_created DESC)
  WHERE status = 'PUBLISHED';
