---
'@curvenote/blocks': patch
'@curvenote/common': minor
'@curvenote/cdn': minor
'@curvenote/scms-core': minor
'@curvenote/scms-server': minor
'@curvenote/scms-tasks': minor
'@curvenote/scms': minor
'@curvenote/scms-db': minor
'@curvenote/cli': minor
'curvenote': minor
---

Introduce `IStorageProvider` with GCS, Azure Blob, and S3 implementations; refactor storage backend and uploads; signed uploads expose `protocol` (`gcs-resumable` | `put`) for browser, tasks, and CLI; add `api.storage` config (legacy GCS keyfile still supported).
