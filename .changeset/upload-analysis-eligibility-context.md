---
'@curvenote/scms-core': patch
---

Add shared manuscript format helpers and upload analysis utilities for check eligibility. Hoist `isPreviewCandidate` and manuscript MIME configuration into scms-core, persistable `upload.analysis` metadata keys, source-signature helpers, and `UploadCheckEligibilityContext` / `UploadFactPresence` types. Extend `ExtensionCheckService.isUploadEligible` with an optional eligibility context so checks can gate on document and metadata facts without re-parsing uploads.
