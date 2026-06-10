-- Trigram GIN index powering affiliation substring search on the public works
-- listing (`dbSearchSubmissionIds` in v1.sites.$siteName.works/db.server.ts).
--
-- Affiliations live at `WorkVersion.metadata['frontmatter.myst'].affiliations` as
-- an array of objects (name, institution, department, city, state, country).
-- The immutable extractor concatenates those fields per affiliation so ILIKE
-- predicates can be served via pg_trgm, matching the authors search contract.

CREATE OR REPLACE FUNCTION work_version_affiliations_search_text(metadata jsonb)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
AS $$
  SELECT COALESCE(
    (
      SELECT string_agg(
        trim(both ' ' from concat_ws(' ',
          NULLIF(trim(aff->>'name'), ''),
          NULLIF(trim(aff->>'institution'), ''),
          NULLIF(trim(aff->>'department'), ''),
          NULLIF(trim(aff->>'city'), ''),
          NULLIF(trim(aff->>'state'), ''),
          NULLIF(trim(aff->>'country'), '')
        )),
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
