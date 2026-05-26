# Architecture

## Layout

`StorageBackend` owns **`IStorageProvider`** and bucket metadata; **`File`** and **`Folder`** call **`this.backend.provider`** for all object operations (no direct `@google-cloud/storage` usage in those classes).

```
StorageBackend (backend.storage/backend.server.ts)
  ├─ resolveStorageConfig(api) + createStorageProvider(config, bucketUriMap)
  ├─ provider: IStorageProvider
  └─ ensureConnection / consoleUrl / summarise / knownBucketFromCDN / …

File (file.server.ts)
  ├─ provider.exists, getMetadata, signReadUrl, signUploadUrl, …
  └─ signUpload() → SignedUploadResult (includes protocol)

Folder (folder.server.ts)
  └─ provider.listObjects, …

modules/storage/
  ├─ provider.interface.ts    # IStorageProvider
  ├─ types.ts                 # StorageConfig, SignedUploadResult, FileMetadata, …
  ├─ factory.server.ts        # resolveStorageConfig, createStorageProvider
  ├─ index.ts
  ├─ gcs/provider.server.ts
  ├─ azure/provider.server.ts
  └─ s3/provider.server.ts
```

```
packages/scms-server/src/
  backend/storage/
    backend.server.ts
    file.server.ts
    folder.server.ts
    upload.resumable.server.ts   # stageFilesForUpload → FileUploadResponse + upload
    constants.server.ts          # KnownBuckets
    types.ts                     # KnownBucketInfo, …
```

This mirrors the pattern used for **`modules/auth/`** (multiple register modules behind a factory).

## Factory

**Source:** `packages/scms-server/src/modules/storage/factory.server.ts`

- **`resolveStorageConfig(api)`** — returns **`StorageConfig`** if `api.storage.provider` is set, or derives **`{ provider: 'gcs', gcs: { secretKeyfile } }`** from **`api.storageSASecretKeyfile`**, or **`null`** if neither is present.
- **`createStorageProvider(config, bucketUriMap)`** — synchronous **`switch`** on **`config.provider`**, constructing **`GcsStorageProvider`**, **`AzureStorageProvider`**, or **`S3StorageProvider`**. Providers are **statically imported** (all SDKs may load when this module loads).

**`bucketUriMap`** maps each logical bucket name (**`KnownBuckets`**) to the **`uri`** value from **`knownBucketInfoMap`** (GCS bucket name, Azure container name, or S3 bucket name).

## Config resolution (conceptual)

```typescript
function resolveStorageConfig(apiConfig: ApiConfig): StorageConfig | null {
  if (apiConfig.storage?.provider) {
    return apiConfig.storage;
  }
  if (apiConfig.storageSASecretKeyfile) {
    return {
      provider: 'gcs',
      gcs: { secretKeyfile: apiConfig.storageSASecretKeyfile },
    };
  }
  return null;
}
```

Legacy deployments keep using **`storageSASecretKeyfile`** without adding **`api.storage`**.

## StorageBackend constructor

If **`resolveStorageConfig`** returns **`null`**, **`StorageBackend`** throws — callers that must tolerate missing storage (e.g. admin UI) catch and show a “not configured” state.
