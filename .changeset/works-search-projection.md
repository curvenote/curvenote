---
'@curvenote/scms-db': patch
'@curvenote/scms': patch
---

Add a site/status-scoped `SubmissionSearch` projection for the public works
listing free-text search. Searchable text (title, authors, DOI, affiliations)
is `unaccent`-normalised and matched with Postgres full-text search plus a
pg_trgm fuzzy fallback, scoped by `site_id`/`status` first so the expensive
match runs only within a single site. Trigger-maintained from
`SubmissionVersion`/`WorkVersion`/`Work`. The projection is the default search
path; set `WORKS_SEARCH_PROJECTION_DISABLED=true` as a kill-switch to fall back
to the legacy ILIKE path instantly without a redeploy.

The listing total now avoids the `Submission`/`SubmissionVersion` join count
where possible: when search/subject already resolves an id set (and no
collection/kind/date filter applies) the count is the id-set size, and an
unfiltered browse count is served directly from the projection
(`COUNT(DISTINCT submission_id)` via a new `(site_id, status, submission_id)`
btree).
