---
'@curvenote/scms': patch
'@curvenote/scms-core': patch
'@curvenote/scms-server': patch
---

Improve work user access controls and move checks dispatch to per-work roles. Rename the work users read scope to `work:users:read`, grant all work roles read access to the user list and check results, and gate work-user management UI on `work:users:update`. Replace global `app:works:checks:dispatch` with per-work `work:checks:dispatch` for owners and contributors; gate checks UI on `app:works:checks:feature` and hide or reject run/retry controls for viewers.
