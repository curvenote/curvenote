---
'@curvenote/scms-server': patch
'@curvenote/scms-doc-preview': patch
'@curvenote/scms': patch
---

Fix CDN object signing against local MinIO / path-style private CDN URLs by resolving the storage bucket via `knownBucketFromCDN` with a private-CDN hostname fallback (`resolveBucketForCdn`)
