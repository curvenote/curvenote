# Multi-provider storage — reference

## Scope

SCMS uses a single abstraction, **`IStorageProvider`**, with three implementations:

| Provider | Package / SDK | Selection |
|----------|-----------------|-----------|
| **Google Cloud Storage (GCS)** | `@google-cloud/storage` | `api.storage.provider: gcs` or legacy `api.storageSASecretKeyfile` |
| **Azure Blob Storage** | `@azure/storage-blob` | `api.storage.provider: azure` + `api.storage.azure` |
| **AWS S3** | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` | `api.storage.provider: s3` + `api.storage.s3` |

`StorageBackend` (`packages/scms-server/src/backend/storage/backend.server.ts`) resolves config via **`resolveStorageConfig`** / **`createStorageProvider`**, builds a **`bucketUriMap`** from **`knownBucketInfoMap`**.**`uri`**, and exposes **`this.provider`** for **`File`** / **`Folder`**.

## Design summary

| Topic | Behavior |
|-------|----------|
| **Bucket topology** | Six logical buckets: `staging`, `hashstore`, `tmp`, `cdn`, `prv`, `pub` — mapped to provider bucket/container names via `knownBucketInfoMap` |
| **Provider in data** | No provider column; deployment config + CDN URLs determine behavior |
| **Admin / ops** | `summarise().providerType`, **`consoleUrl()`** per provider |
| **Uploads** | Server returns **`SignedUploadResult`** (`protocol`: `gcs-resumable` \| `put`); clients branch (see [03-upload-protocol.md](./03-upload-protocol.md)) |
| **Config** | `api.storage` with provider-specific blocks; legacy **`storageSASecretKeyfile`** still resolves to GCS ([04-config-schema.md](./04-config-schema.md)) |
| **Cross-cloud migration** | Optional multi-provider / read-fallback design only — [09-migration-extension.md](./09-migration-extension.md) |
| **Private CDN signing** | Google Cloud CDN URL-prefix signing in production for some deployments; Azure/AWS edge parity is a **known limitation** — [11-cdn-edge-limitations.md](./11-cdn-edge-limitations.md) |

## Document index

| Document | Contents |
|----------|----------|
| [01-architecture.md](./01-architecture.md) | Module layout, factory, config resolution |
| [02-provider-interface.md](./02-provider-interface.md) | **`IStorageProvider`** contract and design notes |
| [03-upload-protocol.md](./03-upload-protocol.md) | Staging API, `gcs-resumable` vs `put`, client responsibilities |
| [04-config-schema.md](./04-config-schema.md) | `api.storage`, legacy fields, schema, examples |
| [05-azure-provider.md](./05-azure-provider.md) | Azure SAS, SDK usage, CORS, private content notes |
| [06-s3-provider.md](./06-s3-provider.md) | Presigned URLs, CloudFront vs origin, CORS |
| [07-cdn-signing.md](./07-cdn-signing.md) | **`getSignedCDNQuery`**, GCS CDN format, other clouds |
| [08-admin-route.md](./08-admin-route.md) | System storage admin route behavior |
| [09-migration-extension.md](./09-migration-extension.md) | Optional cross-provider migration (not implemented) |
| [10-module-reference.md](./10-module-reference.md) | Source file map and responsibilities |
| [11-cdn-edge-limitations.md](./11-cdn-edge-limitations.md) | **`cdn_query`** / prefix signing parity vs blob signing |
