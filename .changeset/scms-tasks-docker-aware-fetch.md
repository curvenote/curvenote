---
'@curvenote/scms-tasks': patch
---

Rewrite MinIO signed URL connect hosts via `dockerAwareFetch` so converter downloads and CDN uploads work from Docker while keeping SigV4 `Host` headers intact.
