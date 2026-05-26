-- Composite indexes powering the submissions-index listing card hot path.
--
-- All three of the following per-page queries filter by a small set of
-- `submission_id`s and need the newest row by `date_created DESC`:
--
--   1. dbListSubmissionsForIndex newest-version subselect
--      (`versions: { take: 1, orderBy: { date_created: 'desc' } }`)
--   2. dbDistinctVersionDates PUBLISHED / RETRACTED dates
--      (DISTINCT ON (submission_id) ORDER BY submission_id, date_created DESC)
--   3. Last-activity lookup
--      (`activity: { take: 1, orderBy: { date_created: 'desc' } }`)
--
-- A sorted composite index on `(submission_id, date_created DESC)` serves
-- all three patterns as index-only / index-scan lookups, eliminating the
-- per-row sort that becomes expensive on large sites.
--
-- IF NOT EXISTS guards mirror the convention from the is_listed migration:
-- Prisma also declares these indexes from the schema edit, so the migration
-- is robust to whichever side runs first.

CREATE INDEX IF NOT EXISTS "SubmissionVersion_submission_id_date_created_idx"
  ON "SubmissionVersion" (submission_id, date_created DESC);

CREATE INDEX IF NOT EXISTS "Activity_submission_id_date_created_idx"
  ON "Activity" (submission_id, date_created DESC);
