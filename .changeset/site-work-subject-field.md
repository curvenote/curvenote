---
'@curvenote/common': minor
'@curvenote/scms-server': minor
---

Add optional `subject` to `SiteWorkDTO`, populated from `WorkVersion.metadata['frontmatter.myst'].project.subject`. Exposed on all SiteWork API responses (works listing, DOI resolve, published work get, submission version get/list, previews). Subject is batch-fetched via a Postgres JSON-path query so the full metadata blob is not loaded into Node. The public works listing (`GET /v1/sites/:siteName/works`) accepts a `subject` query param for case-insensitive exact filtering; pagination links preserve it.
