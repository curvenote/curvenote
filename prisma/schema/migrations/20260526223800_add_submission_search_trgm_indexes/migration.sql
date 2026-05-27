-- Trigram (pg_trgm) GIN indexes powering the submissions-index search path.
--
-- The new submissions listing search (route folder `$siteName.submissions._index`)
-- resolves matching submission ids by ILIKE-substring across the newest version's
-- title / authors / DOI and the underlying work's DOI. A raw SQL EXISTS subquery
-- in `db.server.ts` joins `Submission` -> `SubmissionVersion` -> `WorkVersion`
-- (LEFT JOIN `Work`) and filters with `ILIKE '%' || $q || '%'` predicates against
-- these columns; these GIN trigram indexes let Postgres serve those predicates
-- via index scans instead of seqscanning `WorkVersion`.
--
-- The `authors` column is `text[]`, so we index it via the expression
-- `immutable_array_to_string(authors, ' ')` (defined just below). The expression
-- must match the search query exactly for the planner to pick the index; we do
-- that explicitly in `buildListingRawSqlWhere`.
--
-- Why the wrapper exists: Postgres marks the built-in `array_to_string` as
-- STABLE (not IMMUTABLE) because its generic signature must accommodate element
-- types whose I/O functions are STABLE. Functional indexes require an IMMUTABLE
-- expression. For `text[]` the conversion is identity and the result is purely
-- a function of inputs, so the wrapper is safe to mark IMMUTABLE. `LANGUAGE sql`
-- lets Postgres inline the wrapper at query planning time, so there is no
-- per-row call overhead at scan time.
--
-- These cannot be expressed in `schema.prisma` (expression indexes, GIN
-- opclasses, helper functions) so the schema file is not edited. Same pattern
-- as `20250714112130_pmc_inbox_metadata_gin_index`.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION immutable_array_to_string(text[], text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
AS $$
  SELECT array_to_string($1, $2)
$$;

CREATE INDEX IF NOT EXISTS "WorkVersion_title_trgm_idx"
  ON "WorkVersion" USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "WorkVersion_doi_trgm_idx"
  ON "WorkVersion" USING GIN (doi gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Work_doi_trgm_idx"
  ON "Work" USING GIN (doi gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "WorkVersion_authors_trgm_idx"
  ON "WorkVersion" USING GIN ((immutable_array_to_string(authors, ' ')) gin_trgm_ops);
