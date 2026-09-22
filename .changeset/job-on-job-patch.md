---
'@curvenote/scms-core': patch
'@curvenote/scms-server': patch
---

Add optional `JobRegistration.onJobPatch` hook invoked after `PATCH /api/v1/jobs/:jobId` so extension jobs can map worker updates onto metadata.
