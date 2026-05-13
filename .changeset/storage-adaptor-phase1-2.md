---
'@curvenote/blocks': minor
'@curvenote/common': minor
'@curvenote/scms-core': minor
'@curvenote/scms-server': minor
'@curvenote/scms-tasks': minor
'curvenote': minor
---

Multi-provider storage support (Phase 1 & 2): IStorageProvider interface, GCS extraction, upload protocol abstraction

- Added `IStorageProvider` interface behind which all cloud storage operations are normalised
- Extracted all GCS SDK calls into `GcsStorageProvider` implementation
- Refactored `StorageBackend`, `File`, and `Folder` classes to delegate to provider
- Added `SignedUploadInfo` type with protocol field (`gcs-resumable` | `put`) to `FileUploadResponse`
- Made all upload clients (browser, scms-tasks, CLI) protocol-aware for Azure/S3 support
- Fixed admin storage route crash when no storage is configured
- Added provider badge and provider-aware console links in admin UI
- Added storage provider factory with backwards-compatible config resolution
