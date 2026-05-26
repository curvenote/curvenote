# System storage admin route

**Route:** `platform/scms/app/routes/app/route.system.storage.tsx`  
**Backend:** `StorageBackend` from `packages/scms-server`

## When storage is missing

`StorageBackend` throws if neither **`api.storage`** nor legacy **`storageSASecretKeyfile`** resolves. The loader **catches** that case and returns **`storageConfigured: false`** so the page shows an informational **“storage not configured”** state instead of a 500.

## When storage is present

- **`backend.summarise()`** includes **`providerType`** (`gcs` \| `azure` \| `s3`) for display.
- **Console links** for bucket/key use **`backend.consoleUrl(...)`** (or equivalent), not hardcoded GCS-only URLs — links match the active provider (**Google Cloud Console**, **Azure Portal**, **AWS S3 console**).
- A **badge** (or label) indicates the active provider name for operators.

## Actions

Handlers that construct **`StorageBackend`** for mutations (**query-by-key**, submissions/CDN actions, etc.) use the same pattern: if construction fails, return a clear error (**storage not configured**) instead of an unhandled exception.

## Related types

**`StorageBackend`** in **`@curvenote/scms-core`** (`backend/types.ts`) mirrors the surface used by extensions: **`summarise`**, **`ensureConnection`**, **`expiry`**, etc., without requiring a GCS **`buckets`** map — operations go through the provider on the server implementation.
