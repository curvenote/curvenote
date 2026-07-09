---
'@curvenote/scms': patch
'@curvenote/scms-core': patch
'@curvenote/scms-server': patch
---

Move checks dispatch from global `app:works:checks:dispatch` to per-work `work:checks:dispatch` for owners and contributors, grant all work roles `work:checks:read`, and gate checks UI visibility on `app:works:checks:feature`. Viewers can see check results and timelines but cannot run checks, retry failed runs, or trigger third-party report flows; platform routes reject dispatch intents without the work scope. Extension activity mounts receive `canDispatchChecks` and omit action paths for read-only users.
