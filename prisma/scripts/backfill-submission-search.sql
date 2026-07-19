-- Resumable, batched backfill for the SubmissionSearch projection.
--
-- BREAK-GLASS ONLY. The normal backfill runs as migration
-- `20260625120050_backfill_submission_search` (a single set-based INSERT). Use
-- THIS script when that migration times out and you need to complete the
-- backfill manually, in batches that commit incrementally so progress survives
-- an interruption.
--
-- Usage (direct, session-mode connection so you control timeouts):
--   psql "$DIRECT_DATABASE_URL" -f prisma/scripts/backfill-submission-search.sql
-- or from an interactive psql session:
--   \i prisma/scripts/backfill-submission-search.sql
--
-- Safe to run repeatedly: each batch is `ON CONFLICT DO NOTHING`, so already
-- projected rows are skipped and only missing rows are inserted. Re-running
-- after an interruption simply continues where it stopped.
--
-- After it reports "backfill complete", mark the migration applied and resume:
--   prisma migrate resolve --applied 20260625120050_backfill_submission_search
--   prisma migrate deploy

SET statement_timeout = 0;
SET idle_in_transaction_session_timeout = 0;

DO $$
DECLARE
  batch_size   integer := 5000;
  inserted     integer;
  total        bigint := 0;
BEGIN
  LOOP
    -- Project the next batch of still-missing listed submission versions.
    INSERT INTO "SubmissionSearch" (
      submission_version_id, submission_id, site_id, status, search_text, search_tsv
    )
    SELECT
      sv.id,
      sv.submission_id,
      s.site_id,
      sv.status,
      txt.search_text,
      to_tsvector('simple', txt.search_text)
    FROM "SubmissionVersion" sv
    JOIN "Submission" s ON s.id = sv.submission_id
    JOIN "WorkVersion" wv ON wv.id = sv.work_version_id
    JOIN "Work" w ON w.id = wv.work_id
    CROSS JOIN LATERAL (
      SELECT immutable_unaccent(
        concat_ws(
          ' ',
          wv.title,
          immutable_array_to_string(wv.authors, ' '),
          COALESCE(wv.doi, w.doi),
          work_version_affiliations_search_text(wv.metadata)
        )
      ) AS search_text
    ) txt
    WHERE sv.status IN ('PUBLISHED', 'IN_REVIEW')
      AND NOT EXISTS (
        SELECT 1 FROM "SubmissionSearch" ss
        WHERE ss.submission_version_id = sv.id
      )
    LIMIT batch_size
    ON CONFLICT (submission_version_id) DO NOTHING;

    GET DIAGNOSTICS inserted = ROW_COUNT;
    total := total + inserted;

    -- Commit each batch so progress persists if the session is interrupted.
    COMMIT;

    RAISE NOTICE 'backfilled % rows (running total %)', inserted, total;

    EXIT WHEN inserted = 0;
  END LOOP;

  RAISE NOTICE 'backfill complete: % rows inserted', total;
END $$;
