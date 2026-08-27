---
'@curvenote/scms-server': patch
'@curvenote/scms-tasks': patch
---

Fix PMC deposit status callbacks: allow handshake on submission status updates without site scopes, and make SCMS task client requests throw on failure so jobs are not marked COMPLETED after a failed putStatus.
