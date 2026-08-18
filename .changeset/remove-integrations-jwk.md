---
'@curvenote/scms-server': patch
'@curvenote/scms-core': patch
'@curvenote/scms': patch
---

Remove unused `api.integrations` JWK signing path (`createIntegrationToken` / `verifyIntegrationToken`, `GET /v1/keys`, and related config schema / key-generation scripts)
