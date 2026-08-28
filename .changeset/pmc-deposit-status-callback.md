---
'@curvenote/scms-server': patch
'@curvenote/scms-tasks': minor
---

Fix PMC deposit status callbacks: allow handshake on submission status updates without site scopes; make SCMS task client requests throw on failure; guarantee Pub/Sub acks when onFailure/jobs.failed fail; reject disabled users on submission API context.

BREAKING (`@curvenote/scms-tasks`): `putStatus(status, userId, res)` → `putStatus(status, userId)` — `res` is no longer accepted (Pub/Sub wrapper owns the HTTP response).
