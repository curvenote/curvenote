-- One-time backfill: copy parent Work.contains onto each WorkVersion.
-- Idempotent when re-run (sets the same values again).

SET statement_timeout = 0;

UPDATE "WorkVersion" wv
SET "contains" = w."contains"
FROM "Work" w
WHERE wv."work_id" = w."id";
