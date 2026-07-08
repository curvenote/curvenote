---
'@curvenote/scms': patch
'@curvenote/scms-core': patch
---

Add a route-local author metadata summary for the upload flow. `AuthorMetadataForm` defaults to a read-only `AuthorSummaryView` (names, affiliations, ORCID, corresponding icon) with an Edit toggle into the shared `AuthorField` editor. Normalize ORCID URLs from extracted MyST frontmatter to canonical ids so summary badges render reliably. Tidy the add-author ORCID placeholder input by removing the dashed card wrapper and boxed combo trigger.
