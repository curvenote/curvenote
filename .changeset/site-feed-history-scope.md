---
'@curvenote/scms-core': patch
'@curvenote/scms-server': patch
'@curvenote/scms-sites-ext': patch
'@curvenote/scms-db': patch
---

Add `SiteRole.FEED` and `site:history` scope for ETL published-history consumers. Grant `site:history` to all site roles; FEED is history-only. ETL history authorizes on `site:history` (or system.admin), not site ADMIN.
