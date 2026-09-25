---
'@curvenote/scms': patch
'@curvenote/scms-server': patch
'@curvenote/scms-tasks': patch
'@curvenote/task-converter': patch
---

Link converter jobs at enqueue (drop Job.payload JSONB scan), send only sanitized linked-job fields to the browser, guard web Retry against in-flight jobs, and harden dockerAwareFetch (signal/Request headers) while sharing it for signed URL downloads.
