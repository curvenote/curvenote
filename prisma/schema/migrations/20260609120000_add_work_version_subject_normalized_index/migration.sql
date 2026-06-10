-- prisma-migrate-disable-next-transaction
-- Expression index powering exact subject filter on the public works listing
-- (`fetchSubmissionIdsBySubject` in packages/scms-server).
--
-- The filter is case- and whitespace-insensitive equality on
-- `WorkVersion.metadata['frontmatter.myst'].subject`. Without an index the
-- query walks every submission on the site and evaluates JSON extraction per
-- version row. The listing query is rewritten to start from matching
-- `WorkVersion` rows (usually a tiny set) and join back through
-- `SubmissionVersion` (status) to `Submission` (site_id).
--
-- The normalizer and partial-index predicate MUST match the WHERE clause
-- exactly for the planner to use the index — same contract as
-- `immutable_array_to_string` for trgm search. The query adds
-- `wv.metadata IS NOT NULL` alongside the normalizer equality check.
--
-- CONCURRENTLY + no transaction: same large-table / statement_timeout
-- constraints as `20260610120000_add_work_version_affiliations_trgm_index`.
--
-- Cannot be expressed in schema.prisma (expression index + helper function);
-- same pattern as `20260526223800_add_submission_search_trgm_indexes`.

SET statement_timeout = 0;

CREATE OR REPLACE FUNCTION work_version_subject_normalized(metadata jsonb)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
AS $$
  SELECT NULLIF(LOWER(TRIM(metadata #>> '{frontmatter.myst,subject}')), '')
$$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "WorkVersion_subject_normalized_idx"
  ON "WorkVersion" (work_version_subject_normalized(metadata))
  WHERE metadata IS NOT NULL;
