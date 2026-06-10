-- Trigram GIN index powering affiliation substring search on the public works
-- listing (`dbSearchSubmissionIds` in v1.sites.$siteName.works/db.server.ts).
--
-- Affiliations live at `WorkVersion.metadata['frontmatter.myst'].affiliations` as
-- an array of objects keyed by local ids (e.g. "a1") with a human-readable `name`.
-- Author entries reference those ids in their own `affiliations` arrays; search
-- targets the resolved affiliation `name` (MyST `institution` when `name` absent).

CREATE OR REPLACE FUNCTION work_version_affiliations_search_text(metadata jsonb)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
AS $$
  SELECT COALESCE(
    (
      SELECT string_agg(
        COALESCE(
          NULLIF(trim(aff->>'name'), ''),
          NULLIF(trim(aff->>'institution'), '')
        ),
        ' '
      )
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(metadata #> '{frontmatter.myst,affiliations}') = 'array'
          THEN metadata #> '{frontmatter.myst,affiliations}'
          ELSE '[]'::jsonb
        END
      ) AS aff
      WHERE jsonb_typeof(aff) = 'object'
    ),
    ''
  )
$$;

CREATE INDEX IF NOT EXISTS "WorkVersion_affiliations_trgm_idx"
  ON "WorkVersion" USING GIN ((work_version_affiliations_search_text(metadata)) gin_trgm_ops)
  WHERE metadata IS NOT NULL;
