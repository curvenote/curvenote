-- Search projection for the public works listing free-text search.
--
-- The previous search (`dbSearchSubmissionIds` in
-- platform/scms/app/routes/api/v1.sites.$siteName.works/db.server.ts) resolved
-- matching submission ids with a UNION of ILIKE branches over `WorkVersion` /
-- `Work` ACROSS ALL TENANTS, then joined back to `SubmissionVersion` /
-- `Submission` to apply the selective `site_id` + `status` filter LAST. On large
-- multi-tenant data (600k+ work versions) common author/affiliation terms
-- produced huge global candidate sets before the site filter pruned them.
--
-- This projection co-locates the selective keys (`site_id`, `status`,
-- `submission_id`) with the searchable text for every LISTED submission version
-- (PUBLISHED / IN_REVIEW only), so the scoped filter is applied FIRST and the
-- text match (FTS + pg_trgm fuzzy) runs only within a single site's rows.
--
-- Searchable text is built from the same sources as the old ILIKE branches
-- (WorkVersion.title / authors, the work's DOI as WorkVersion.doi falling back
-- to Work.doi, and affiliation names from WorkVersion.metadata) and is
-- `unaccent`-normalised so accented and unaccented spellings match symmetrically
-- (e.g. "muller" <-> "Müller").
--
-- This migration installs DDL ONLY (extensions, helper functions, the
-- `SubmissionSearch` table and its maintenance triggers). It is intentionally
-- atomic and fast so it can be rolled back cleanly. The one-time backfill of
-- existing rows lives in the follow-on migration
-- `20260625120050_backfill_submission_search`, and the compound GIN indexes
-- (needing `btree_gin` for the scalar leading keys and `gin_trgm_ops` for fuzzy
-- text) are created CONCURRENTLY in `20260625120100_add_submission_search_indexes`
-- so neither the large backfill nor the large index builds hold a long lock
-- inside this migration's transaction.
--
-- Ordering rationale (DDL -> backfill -> indexes): backfilling before the GIN
-- indexes exist means the bulk insert does not pay per-row index maintenance,
-- and if the backfill times out the operator completes it on an unindexed table
-- (see the runbook in the backfill migration) before the indexes are built once
-- over the full table.

SET statement_timeout = 0;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- IMMUTABLE unaccent wrapper. The stock `unaccent(text)` is STABLE (it resolves
-- a dictionary at runtime), so it cannot be used in stored/generated
-- expressions or expression indexes. Pinning the dictionary name lets us mark
-- the wrapper IMMUTABLE, same pattern as `immutable_array_to_string`
-- (migration `20260526223800`).
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
AS $$
  SELECT unaccent('unaccent', $1)
$$;

-- Single source of truth for the searchable text of one work version. STABLE
-- (reads tables); the per-row normalisation it calls is IMMUTABLE.
CREATE OR REPLACE FUNCTION submission_search_text(p_work_version_id text)
  RETURNS text
  LANGUAGE sql
  STABLE
AS $$
  SELECT immutable_unaccent(
    concat_ws(
      ' ',
      wv.title,
      immutable_array_to_string(wv.authors, ' '),
      COALESCE(wv.doi, w.doi),
      work_version_affiliations_search_text(wv.metadata)
    )
  )
  FROM "WorkVersion" wv
  JOIN "Work" w ON w.id = wv.work_id
  WHERE wv.id = p_work_version_id
$$;

CREATE TABLE "SubmissionSearch" (
  "submission_version_id" TEXT PRIMARY KEY,
  "submission_id"         TEXT NOT NULL,
  "site_id"               TEXT NOT NULL,
  "status"                TEXT NOT NULL,
  "search_text"           TEXT NOT NULL DEFAULT '',
  "search_tsv"            tsvector NOT NULL DEFAULT ''::tsvector,
  CONSTRAINT "SubmissionSearch_submission_version_id_fkey"
    FOREIGN KEY ("submission_version_id")
    REFERENCES "SubmissionVersion"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Recompute (upsert/delete) the projection row for a single submission version.
-- Idempotent; runs in the caller's transaction.
CREATE OR REPLACE FUNCTION submission_search_refresh_sv(p_sv_id text)
  RETURNS void
  LANGUAGE plpgsql
AS $$
DECLARE
  v_status          text;
  v_submission_id   text;
  v_work_version_id text;
  v_site_id         text;
  v_text            text;
BEGIN
  SELECT sv.status, sv.submission_id, sv.work_version_id, s.site_id
    INTO v_status, v_submission_id, v_work_version_id, v_site_id
  FROM "SubmissionVersion" sv
  JOIN "Submission" s ON s.id = sv.submission_id
  WHERE sv.id = p_sv_id;

  -- Only listed statuses are projected; anything else is removed.
  IF NOT FOUND OR v_status NOT IN ('PUBLISHED', 'IN_REVIEW') THEN
    DELETE FROM "SubmissionSearch" WHERE submission_version_id = p_sv_id;
    RETURN;
  END IF;

  v_text := submission_search_text(v_work_version_id);

  INSERT INTO "SubmissionSearch" (
    submission_version_id, submission_id, site_id, status, search_text, search_tsv
  )
  VALUES (
    p_sv_id, v_submission_id, v_site_id, v_status, v_text, to_tsvector('simple', v_text)
  )
  ON CONFLICT (submission_version_id) DO UPDATE
    SET submission_id = EXCLUDED.submission_id,
        site_id       = EXCLUDED.site_id,
        status        = EXCLUDED.status,
        search_text   = EXCLUDED.search_text,
        search_tsv    = EXCLUDED.search_tsv;
END;
$$;

-- Trigger glue ----------------------------------------------------------------

-- SubmissionVersion: insert/delete + the columns that move a row in/out of the
-- projection or change which work version it points at.
CREATE OR REPLACE FUNCTION submission_search_tg_submission_version()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM "SubmissionSearch" WHERE submission_version_id = OLD.id;
    RETURN NULL;
  END IF;
  PERFORM submission_search_refresh_sv(NEW.id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER submission_search_sv_iud
AFTER INSERT OR DELETE ON "SubmissionVersion"
FOR EACH ROW EXECUTE FUNCTION submission_search_tg_submission_version();

CREATE TRIGGER submission_search_sv_u
AFTER UPDATE OF status, work_version_id, submission_id ON "SubmissionVersion"
FOR EACH ROW EXECUTE FUNCTION submission_search_tg_submission_version();

-- WorkVersion: text-bearing columns changed -> refresh every submission version
-- that points at this work version.
CREATE OR REPLACE FUNCTION submission_search_tg_work_version()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM "SubmissionVersion" WHERE work_version_id = NEW.id
  LOOP
    PERFORM submission_search_refresh_sv(r.id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER submission_search_wv_u
AFTER UPDATE OF title, authors, doi, metadata ON "WorkVersion"
FOR EACH ROW EXECUTE FUNCTION submission_search_tg_work_version();

-- Work: doi changed -> refresh submission versions for all of the work's versions.
CREATE OR REPLACE FUNCTION submission_search_tg_work()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT sv.id
    FROM "SubmissionVersion" sv
    JOIN "WorkVersion" wv ON wv.id = sv.work_version_id
    WHERE wv.work_id = NEW.id
  LOOP
    PERFORM submission_search_refresh_sv(r.id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER submission_search_work_u
AFTER UPDATE OF doi ON "Work"
FOR EACH ROW WHEN (OLD.doi IS DISTINCT FROM NEW.doi)
EXECUTE FUNCTION submission_search_tg_work();

-- Backfill of existing rows is performed in the follow-on migration
-- `20260625120050_backfill_submission_search` (kept separate so a slow backfill
-- can be completed manually via psql without re-running this DDL).
