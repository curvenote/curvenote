---
'@curvenote/scms-server': patch
'@curvenote/scms-db': patch
'@curvenote/scms': patch
---

Extend free-text search on the public works listing (`GET /v1/sites/:siteName/works?q=...`) to match affiliation names from `WorkVersion.metadata['frontmatter.myst'].affiliations`.

- **Index:** add `work_version_affiliations_search_text(metadata)` GIN trigram index on `WorkVersion` via `CREATE INDEX CONCURRENTLY` (large-table safe), extracting each affiliation's `name` (with `institution` fallback).
- **Query:** add an `OR` branch to `dbSearchSubmissionIds` alongside existing title, author, and DOI predicates; omit the affiliation branch when every query token is a common boilerplate stopword (university, department, school, etc.).
- **Tests:** integration coverage for Harvard/Wyss-style affiliation metadata; unit tests for the extractor and stopword gate.

---