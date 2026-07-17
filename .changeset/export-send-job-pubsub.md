---
'@curvenote/scms-server': patch
---

Export `sendJobPubSubMessage` (and related Pub/Sub types) from the jobs public API so extension packages can dispatch Cloud Run workers without embedding publish logic in core.
