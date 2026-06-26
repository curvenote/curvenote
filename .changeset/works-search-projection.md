---
'@curvenote/scms-db': patch
'@curvenote/scms': patch
---

Add a site/status-scoped `SubmissionSearch` projection for the public works
listing free-text search. Searchable text (title, authors, DOIs, affiliations)
is `unaccent`-normalised and matched with Postgres full-text search plus a
pg_trgm fuzzy fallback, scoped by `site_id`/`status` first so the expensive
match runs only within a single site. Trigger-maintained from
`SubmissionVersion`/`WorkVersion`/`Work`. Opt-in behind `WORKS_SEARCH_PROJECTION`
(default off, legacy ILIKE path unchanged) for benchmark-gated rollout.
