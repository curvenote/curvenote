# Module reference

Key paths for multi-provider storage. Paths below are under **`packages/scms-server/src/`** unless noted.

## Core module

| Path | Role |
|------|------|
| `modules/storage/provider.interface.ts` | **`IStorageProvider`** |
| `modules/storage/types.ts` | **`StorageConfig`**, **`SignedUploadResult`**, **`FileMetadata`**, provider credential types |
| `modules/storage/factory.server.ts` | **`resolveStorageConfig`**, **`createStorageProvider`** |
| `modules/storage/index.ts` | Re-exports |
| `modules/storage/gcs/provider.server.ts` | **GcsStorageProvider** |
| `modules/storage/azure/provider.server.ts` | **AzureStorageProvider** |
| `modules/storage/s3/provider.server.ts` | **S3StorageProvider** |

## Backend integration

| Path | Role |
|------|------|
| `backend/storage/backend.server.ts` | **`StorageBackend`** — provider lifecycle, **`consoleUrl`**, **`summarise`**, bucket maps |
| `backend/storage/file.server.ts` | **`File`** — delegates to **`provider`** |
| `backend/storage/folder.server.ts` | **`Folder`** — **`listObjects`**, etc. |
| `backend/storage/upload.resumable.server.ts` | Staging — **`signUpload`**, **`FileUploadResponse.upload`** |
| `backend/storage/constants.server.ts` | **`KnownBuckets`** |
| `backend/storage/types.ts` | **`KnownBucketInfo`**, local types |

## Shared types (upload DTOs)

| Path | Role |
|------|------|
| `packages/blocks/src/sites.ts` | **`SignedUploadInfo`**, **`FileUploadResponse`**, **`UploadFileInfo`** |
| `packages/common/src/types/index.ts` | Re-exports **`SignedUploadInfo`**, **`FileUploadResponse`**, **`UploadStagingDTO`** |

## Clients (upload protocol)

| Path | Role |
|------|------|
| `packages/scms-core/src/components/upload/utils.ts` | Browser **`handleFileUpload`**, **`gcs-resumable`** vs **`put`** |
| `packages/scms-tasks/src/uploads.ts` | Task worker uploads |
| `packages/curvenote-cli/src/uploads/` | CLI staging and PUT/resumable |

## Config

| Path | Role |
|------|------|
| `/.app-config.schema.yml` | **`api.storage`** shape; **`storageSASecretKeyfile`** optional |
| `/.app-config.sample.yml` | Examples for **gcs** / **azure** / **s3** |

## Admin UI

| Path | Role |
|------|------|
| `platform/scms/app/routes/app/route.system.storage.tsx` | Storage admin page |

## Private CDN signing (orthogonal)

| Path | Role |
|------|------|
| `packages/scms-server/src/backend/sign.private.server.ts` | **`getSignedCDNQuery`**, **`signPrivateUrls`** (GCS Cloud CDN HMAC) |

## Facade type (extensions)

| Path | Role |
|------|------|
| `packages/scms-core/src/backend/types.ts` | **`StorageBackend`** interface for handlers that receive backend from server |
