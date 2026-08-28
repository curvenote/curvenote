---
'@curvenote/scms-server': patch
'@curvenote/scms-tasks': patch
---

Fix PMC deposit status callbacks: allow handshake on submission status updates without site scopes; make SCMS task client requests throw on failure; guarantee Pub/Sub acks when onFailure/jobs.failed fail; reject disabled users on submission API context.
