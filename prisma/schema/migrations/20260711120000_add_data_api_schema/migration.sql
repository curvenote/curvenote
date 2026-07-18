-- Data API (PostgREST / Supabase Data API) exposure for read-side consumers.
--
-- Instead of raw table access over per-process Prisma connection pools,
-- consumers go through PostgREST, which holds a single server-side pool.
-- In production this is the Supabase Data API; locally it is the `postgrest`
-- service in docker-compose.yml pointed at this same database.
--
-- Only the curated `api` schema is exposed (PGRST_DB_SCHEMAS=api). The views
-- run with their owner's privileges, so no grants on the underlying tables
-- are handed to the Data API roles. The surface is complete enough for
-- consumers to run without the v1 REST API: discovery, per-site listings with
-- every v1 filter dimension, DOI resolution, version history, and the CDN
-- pointers for both work bundles and site content bundles.

-- 1. PostgREST role model. These roles already exist on Supabase; create them
--    conditionally so the migration is portable across local dev, CI, and
--    Supabase-managed databases.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    -- Local-dev password, matching the docker-compose postgres credentials.
    -- On Supabase the authenticator role is managed by the platform.
    CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'curvenote';
  END IF;
END
$$;

GRANT anon TO authenticator;
GRANT service_role TO authenticator;

-- 2. The exposed schema.
CREATE SCHEMA IF NOT EXISTS api;

-- Recreate from scratch so column changes never fight CREATE OR REPLACE rules.
DROP VIEW IF EXISTS api.published_works;
DROP VIEW IF EXISTS api.site_works;
DROP VIEW IF EXISTS api.site_collections;
DROP VIEW IF EXISTS api.site_kinds;
DROP VIEW IF EXISTS api.sites;

-- Sites with domains, content counts, and the CDN pointer of the site's own
-- content bundle (landing pages / docs — the latest version of Site.content,
-- mirroring the v1 site DTO's content host).
CREATE VIEW api.sites AS
SELECT
  s.id,
  s.name,
  s.title,
  s.description,
  s.private,
  s.restricted,
  s.external,
  s.date_created,
  (
    SELECT COALESCE(json_agg(d.hostname ORDER BY d.hostname), '[]'::json)
    FROM "Domain" d
    WHERE d.site_id = s.id
  ) AS domains,
  (
    SELECT d.hostname
    FROM "Domain" d
    WHERE d.site_id = s.id
    ORDER BY d."default" DESC, d.hostname ASC
    LIMIT 1
  ) AS primary_domain,
  (
    SELECT count(*)
    FROM "Submission" sub
    WHERE sub.site_id = s.id
      AND EXISTS (
        SELECT 1 FROM "SubmissionVersion" sv
        WHERE sv.submission_id = sub.id AND sv.status = 'PUBLISHED'
      )
  ) AS published_works,
  (SELECT count(*) FROM "Collection" c WHERE c.site_id = s.id) AS collections,
  (SELECT count(*) FROM "SubmissionKind" k WHERE k.site_id = s.id) AS kinds,
  content_version.cdn AS content_cdn,
  content_version.cdn_key AS content_cdn_key
FROM "Site" s
LEFT JOIN LATERAL (
  SELECT wv.cdn, wv.cdn_key
  FROM "WorkVersion" wv
  WHERE wv.work_id = s.content_id
  ORDER BY wv.date_created DESC
  LIMIT 1
) content_version ON true
WHERE NOT s.private;

-- Collections per site with published-work counts.
CREATE VIEW api.site_collections AS
SELECT
  c.id,
  s.name AS site_name,
  c.name,
  c.slug,
  c.open,
  c."default",
  (
    SELECT count(*)
    FROM "Submission" sub
    WHERE sub.collection_id = c.id
      AND EXISTS (
        SELECT 1 FROM "SubmissionVersion" sv
        WHERE sv.submission_id = sub.id AND sv.status = 'PUBLISHED'
      )
  ) AS published_works
FROM "Collection" c
JOIN "Site" s ON s.id = c.site_id
WHERE NOT s.private;

-- Submission kinds per site.
CREATE VIEW api.site_kinds AS
SELECT
  k.id,
  s.name AS site_name,
  k.name,
  k."default"
FROM "SubmissionKind" k
JOIN "Site" s ON s.id = k.site_id
WHERE NOT s.private;

-- The published works of every site: one row per submission, carrying its
-- latest published version, the site context, the primary slug, the MyST
-- subject, the CDN content pointer, and the full published-version history
-- as JSON. This is the Data API equivalent of the v1 works listing +
-- published-work + DOI endpoints in one relation; PostgREST column selection
-- keeps listings cheap (skip `versions`/`authors_text` there).
CREATE VIEW api.site_works AS
SELECT DISTINCT ON (sub.id)
  sub.id AS submission_id,
  sv.id AS submission_version_id,
  s.name AS site,
  s.title AS site_title,
  (
    SELECT d.hostname
    FROM "Domain" d
    WHERE d.site_id = s.id
    ORDER BY d."default" DESC, d.hostname ASC
    LIMIT 1
  ) AS site_domain,
  (
    SELECT sl.slug FROM "Slug" sl
    WHERE sl.submission_id = sub.id AND sl."primary"
    LIMIT 1
  ) AS slug,
  wv.work_id,
  wv.id AS work_version_id,
  wv.title,
  wv.description,
  wv.authors,
  array_to_string(wv.authors, ' ') AS authors_text,
  COALESCE(wv.doi, w.doi) AS doi,
  wv.tags,
  wv.date,
  wv.canonical,
  wv.metadata #>> '{frontmatter.myst,subject}' AS subject,
  kind.name AS kind,
  col.name AS collection,
  sv.date_published,
  sv.date_created AS version_date_created,
  wv.cdn,
  wv.cdn_key,
  (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'submission_version_id', v.id,
          'date', COALESCE(v.date_published, v.date_created),
          'tags', v.tags,
          'cdn', vwv.cdn,
          'cdn_key', vwv.cdn_key
        )
        ORDER BY v.date_created DESC
      ),
      '[]'::json
    )
    FROM "SubmissionVersion" v
    JOIN "WorkVersion" vwv ON vwv.id = v.work_version_id
    WHERE v.submission_id = sub.id AND v.status = 'PUBLISHED'
  ) AS versions
FROM "SubmissionVersion" sv
JOIN "WorkVersion" wv ON wv.id = sv.work_version_id
JOIN "Work" w ON w.id = wv.work_id
JOIN "Submission" sub ON sub.id = sv.submission_id
JOIN "Site" s ON s.id = sub.site_id
JOIN "SubmissionKind" kind ON kind.id = sub.kind_id
JOIN "Collection" col ON col.id = sub.collection_id
WHERE sv.status = 'PUBLISHED' AND NOT s.private
ORDER BY sub.id, sv.date_published DESC NULLS LAST, sv.date_created DESC;

-- Platform-wide totals + recent publications in one round trip
-- (POST /rpc/platform_stats). Public content only, like the views: everything
-- is computed over public (NOT private) sites. SECURITY DEFINER so it can read
-- the base tables with the owner's rights, like the views above; the
-- search_path is pinned and every relation schema-qualified, per SECURITY
-- DEFINER best practice.
CREATE OR REPLACE FUNCTION api.platform_stats(recent_count int DEFAULT 5)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT json_build_object(
    'totals', json_build_object(
      'sites', (SELECT count(*) FROM public."Site" WHERE NOT private),
      'published_works', (SELECT count(*) FROM api.site_works),
      'collections', (
        SELECT count(*)
        FROM public."Collection" c
        JOIN public."Site" s ON s.id = c.site_id
        WHERE NOT s.private
      )
    ),
    'recent_publications', (
      SELECT COALESCE(json_agg(row_to_json(recent)), '[]'::json)
      FROM (
        SELECT sw.title, sw.authors, sw.doi, sw.date_published, sw.site, sw.work_id, sw.slug
        FROM api.site_works sw
        ORDER BY sw.date_published DESC NULLS LAST, sw.version_date_created DESC
        LIMIT GREATEST(recent_count, 0)
      ) recent
    )
  );
$$;

-- 3. Grants: the exposed surface is public content only (every view filters
--    NOT private), so anon may read it.
--    service_role keeps access for privileged consumers.
GRANT USAGE ON SCHEMA api TO anon, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA api TO anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA api TO anon, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT SELECT ON TABLES TO anon, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT EXECUTE ON FUNCTIONS TO anon, service_role;

-- Ask a running PostgREST to reload its schema cache (no-op elsewhere).
NOTIFY pgrst, 'reload schema';
