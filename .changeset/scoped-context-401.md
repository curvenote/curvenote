---
'@curvenote/scms-server': patch
'@curvenote/scms': patch
---

Fix `withAppScopedContext` silently redirecting instead of throwing 401 when `{ redirect: true }` is not set.
