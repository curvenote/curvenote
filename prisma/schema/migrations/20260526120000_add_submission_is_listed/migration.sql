-- 1. Column
ALTER TABLE "Submission"
  ADD COLUMN "is_listed" BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Backfill from existing version states.
--    A submission is "listed" iff it has at least one version and no version
--    is in DRAFT or INCOMPLETE status.
UPDATE "Submission" s
SET is_listed = (
  EXISTS (SELECT 1 FROM "SubmissionVersion" v WHERE v.submission_id = s.id)
  AND NOT EXISTS (
    SELECT 1 FROM "SubmissionVersion" v
    WHERE v.submission_id = s.id
      AND v.status IN ('DRAFT','INCOMPLETE')
  )
);

-- 3. Recompute function: idempotent, runs in the caller's transaction.
--    Named generically so future denormalised listing columns (cached_title,
--    active_status, last_activity_at, ...) can be added by extending the body
--    rather than introducing new triggers.
CREATE OR REPLACE FUNCTION submission_recompute_listing_fields() RETURNS TRIGGER AS $$
DECLARE
  affected_id TEXT;
BEGIN
  affected_id := COALESCE(NEW.submission_id, OLD.submission_id);

  UPDATE "Submission" s
  SET is_listed = (
    EXISTS (SELECT 1 FROM "SubmissionVersion" v
            WHERE v.submission_id = affected_id)
    AND NOT EXISTS (
      SELECT 1 FROM "SubmissionVersion" v
      WHERE v.submission_id = affected_id
        AND v.status IN ('DRAFT','INCOMPLETE')
    )
  )
  WHERE s.id = affected_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4a. INSERT / DELETE on SubmissionVersion -> recompute
CREATE TRIGGER submission_recompute_listing_fields_iud
AFTER INSERT OR DELETE ON "SubmissionVersion"
FOR EACH ROW EXECUTE FUNCTION submission_recompute_listing_fields();

-- 4b. UPDATE only fires when status actually changes
CREATE TRIGGER submission_recompute_listing_fields_u
AFTER UPDATE OF status ON "SubmissionVersion"
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION submission_recompute_listing_fields();

-- 5. Partial index sized exactly for the listing query:
--    WHERE site_id = ? AND is_listed = TRUE
--    ORDER BY date_published DESC, date_created DESC
CREATE INDEX "Submission_is_listed_listing_idx"
  ON "Submission" (site_id, date_published DESC, date_created DESC)
  WHERE is_listed = TRUE;

-- 6. Full site_id index. Prisma also declares this from the schema edit;
--    the IF NOT EXISTS guard makes the migration robust to whichever runs first.
CREATE INDEX IF NOT EXISTS "Submission_site_id_idx"
  ON "Submission" (site_id);
