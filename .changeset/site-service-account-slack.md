---
'@curvenote/scms-server': patch
'@curvenote/scms-sites-ext': patch
'@curvenote/scms': patch
---

Add Slack (and Segment) notifications when site admins create or delete a site service account, and when they create or delete tokens for that account. Shared event types live in scms-server; site-specific message/metadata helpers live in the sites extension.
