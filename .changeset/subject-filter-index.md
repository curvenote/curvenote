---
'@curvenote/scms-server': patch
'@curvenote/scms-db': patch
'@curvenote/scms': patch
---

Speed up exact subject filtering on the public works listing (`GET /v1/sites/:siteName/works?subject=...`).

- **Index:** add `work_version_subject_normalized(metadata)` expression index on `WorkVersion` via `CREATE INDEX CONCURRENTLY` (large-table safe) for case- and whitespace-insensitive equality on `metadata['frontmatter.myst'].subject`.
- **Query:** rewrite `fetchSubmissionIdsBySubject` to start from matching work versions and join back through `SubmissionVersion` (status) to `Submission` (site), instead of scanning every submission on the site with an `EXISTS` subquery that evaluates JSON extraction per row.
