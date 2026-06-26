-- prisma-migrate-disable-next-transaction
-- Compound GIN indexes for the works search projection
-- (`SubmissionSearch`, migration `20260625120000_add_submission_search_projection`).
--
-- Both lead with the selective scalar keys `site_id` + `status` (via the
-- `btree_gin` extension) so a single index scan applies the site/status filter
-- and the text match together:
--   - `search_tsv` GIN powers the full-text `@@` branch (token / word-gap correct).
--   - `search_text gin_trgm_ops` GIN powers the `<%` word_similarity fuzzy branch.
--
-- CONCURRENTLY + no transaction: standard CREATE INDEX blocks writes and can
-- exceed Supabase statement_timeout on large tables (P3018 / 57014); same
-- constraint as `20260610120000_add_work_version_affiliations_trgm_index`.
--
-- These cannot be expressed in schema.prisma (multicolumn GIN + opclasses), so
-- the model is declared without them and they live here as raw SQL; same
-- pattern as `20260526223800_add_submission_search_trgm_indexes`.
--
-- Follow-on (separate migration, after this ships and bakes): once the
-- projection fully replaces the legacy path, the per-column trigram indexes that
-- existed only for that path become redundant and can be dropped to reclaim
-- space -- `WorkVersion_title_trgm_idx`, `WorkVersion_doi_trgm_idx`,
-- `WorkVersion_authors_trgm_idx`, `WorkVersion_affiliations_trgm_idx`,
-- `Work_doi_trgm_idx`. Confirm zero usage via `pg_stat_user_indexes` first and
-- keep the btree `doi` indexes (DOI resolution endpoint still needs them).

SET statement_timeout = 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "SubmissionSearch_site_status_tsv_idx"
  ON "SubmissionSearch" USING GIN (site_id, status, search_tsv);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "SubmissionSearch_site_status_trgm_idx"
  ON "SubmissionSearch" USING GIN (site_id, status, search_text gin_trgm_ops);
