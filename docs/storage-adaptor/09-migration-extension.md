# Extension: cross-provider migration (design)

**Status:** Not implemented. The shipped product uses **one** active **`api.storage.provider`** and a single **`IStorageProvider`** per process.

This document records a **possible** extension for organizations moving objects between clouds (e.g. GCS → Azure) without losing the abstraction.

## Motivation

- Reads from **legacy** storage until blobs are copied.
- Writes to **primary** only.
- Eventually retire legacy credentials and CDN bases.

## Illustrative config

```yaml
api:
  storage:
    providers:
      primary:
        provider: azure
        azure: { accountName: ..., accountKey: ... }
      legacy:
        provider: gcs
        gcs: { secretKeyfile: ... }
    active: primary
```

## Illustrative `StorageBackend` shape

```typescript
class StorageBackend {
  provider: IStorageProvider;
  legacyProvider?: IStorageProvider;
}
```

## Read fallback (concept)

`File.exists` / `sign` could check **primary** first, then **legacy**, for the same logical **`bucket` + `id`** if both providers share path conventions and **`bucketUriMap`** alignment.

## Cross-cloud copy

No vendor API copies between clouds. A **stream** from **`legacyProvider.createReadStream`** into **`primaryProvider.writeStream`** (or buffer for small files) is the general pattern. Bulk migration is better done as an **offline job** than per-request in app code.

## CDN URL updates

**`WorkVersion.cdn`** may change when cutover completes; **`cdn_key`** path layout can stay stable across providers.

## Estimation

Touch **`StorageBackend`**, **`File`**, **`Folder`**, config resolution, and ops runbooks. The **`IStorageProvider`** interface itself need not change — only composition and routing.
