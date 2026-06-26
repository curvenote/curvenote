-- One-time backfill of the SubmissionSearch projection for existing rows.
--
-- The DDL (table, helper functions, maintenance triggers) is created in the
-- previous migration `20260625120000_add_submission_search_projection`. From the
-- moment those triggers exist, every NEW / changed listed submission version is
-- projected automatically; this migration only populates rows that already
-- existed before the triggers were installed.
--
-- This is a single set-based, idempotent INSERT (`ON CONFLICT DO NOTHING`), so:
--   * a partial run is impossible -- one statement either fully commits or fully
--     rolls back, leaving the table empty if it times out; and
--   * re-running it (here or in psql) only fills in rows still missing.
--
-- statement_timeout is disabled for the migration session below, but external
-- wall-clock limits (CI step / connection pooler / deploy job) can still abort a
-- very large backfill. If that happens this migration is marked FAILED and the
-- index migration that follows does NOT run.
--
-- ============================================================================
-- BREAK-GLASS RUNBOOK -- completing the backfill manually via psql
-- ============================================================================
-- If this migration times out during `prisma migrate deploy`:
--
--   1. Connect with psql using a DIRECT (non-pooled, session-mode) connection
--      so server-side timeouts are under your control:
--        psql "$DIRECT_DATABASE_URL"
--
--   2. Run the resumable, batched backfill (commits per batch, so progress
--      survives an interruption and you can re-run to continue):
--        \i prisma/scripts/backfill-submission-search.sql
--
--   3. Sanity-check completion (expect 0):
--        SELECT count(*)
--        FROM "SubmissionVersion" sv
--        WHERE sv.status IN ('PUBLISHED','IN_REVIEW')
--          AND NOT EXISTS (
--            SELECT 1 FROM "SubmissionSearch" ss
--            WHERE ss.submission_version_id = sv.id
--          );
--
--   4. Tell Prisma this migration is done, then let deploy build the indexes:
--        prisma migrate resolve --applied 20260625120050_backfill_submission_search
--        prisma migrate deploy
-- ============================================================================

SET statement_timeout = 0;

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
ON CONFLICT (submission_version_id) DO NOTHING;
