---
'@curvenote/scms': patch
---

Speed up free-text search on the public works listing (`GET /v1/sites/:siteName/works?q=...`).

Rewrite `dbSearchSubmissionIds` to UNION single-field trigram probes on `WorkVersion` / `Work`, then join back to submissions by `site_id`, instead of a correlated `EXISTS` that looped once per submission on large sites.
