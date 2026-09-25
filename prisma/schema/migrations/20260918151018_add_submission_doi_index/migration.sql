-- prisma-migrate-disable-next-transaction
-- DOI resolution probes Submission.doi first (`sites.doi`, `doi.resolve`).
--
-- CONCURRENTLY on large production tables; IF NOT EXISTS for safe retries.

SET statement_timeout = 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Submission_doi_idx" ON "Submission" ("doi");
