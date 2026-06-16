-- Indexes powering the public works listing hot path
-- (`GET /v1/sites/:siteName/works`, handled by
-- `platform/scms/app/routes/api/v1.sites.$siteName.works/db.server.ts`).
--
-- The listing roots at `Submission`, filters by `site_id`, and orders by
-- `date_published DESC, date_created DESC` with LIMIT/OFFSET. Each candidate
-- row is gated by an `EXISTS (... SubmissionVersion.status = 'PUBLISHED')`
-- semijoin.
--
-- 1. Submission composite: lets both the page query and the COUNT filter by
--    `site_id` and read rows already in `date_published DESC, date_created
--    DESC` order, so the page query becomes an index range scan that
--    short-circuits at LIMIT instead of sorting the whole site's submissions.
--
--    This is the non-partial twin of `Submission_is_listed_listing_idx`
--    (migration 20260526120000). That index is `WHERE is_listed = TRUE`, but
--    the public endpoint keys on "has a PUBLISHED version", which is NOT the
--    same predicate (a published work with an in-progress draft has
--    `is_listed = FALSE` yet must still be listed), so the partial index is
--    not eligible for this query.
--
-- 2. SubmissionVersion (submission_id, status): turns the `EXISTS` status
--    probe into an index-only lookup rather than reading version rows.
--
-- IF NOT EXISTS guards mirror the convention from the is_listed and
-- listing-lookup migrations: Prisma also declares these indexes from the
-- schema edit, so the migration is robust to whichever side runs first.

CREATE INDEX IF NOT EXISTS "Submission_site_id_date_published_date_created_idx"
  ON "Submission" (site_id, date_published DESC, date_created DESC);

CREATE INDEX IF NOT EXISTS "SubmissionVersion_submission_id_status_idx"
  ON "SubmissionVersion" (submission_id, status);
