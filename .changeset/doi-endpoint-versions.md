---
'@curvenote/common': minor
'@curvenote/scms-server': minor
---

Return a `versions` summary array (submission version id, primary `v{n}` tag, date, and all tags) from the site DOI endpoint (`GET /v1/sites/:site/doi/:first/:second`). This lets clients render version navigation from a single request instead of a follow-up call to the submission `links.versions` listing. Adds a `pickVersionTag` helper and `SiteWorkVersionDTO` type to `@curvenote/common`.
