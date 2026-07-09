-- Composite index powering the works-index listing "last activity" lookup:
--   `activity: { take: 1, orderBy: { date_created: 'desc' } }` per work row.
--
-- IF NOT EXISTS mirrors the listing lookup index migrations: Prisma also
-- declares this index from the schema edit, so the migration is robust to
-- whichever side runs first.

CREATE INDEX IF NOT EXISTS "Activity_work_id_date_created_idx"
  ON "Activity" (work_id, date_created DESC);
