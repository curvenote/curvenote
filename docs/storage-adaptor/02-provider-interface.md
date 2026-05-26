# Provider interface

**Canonical source:** `packages/scms-server/src/modules/storage/provider.interface.ts` and `types.ts`. The snippets below match the abstraction; minor drift is possible — prefer the source files.

## Types

```typescript
import type { Readable } from 'stream';

export type ProviderType = 'gcs' | 'azure' | 's3';

export interface FileMetadata {
  name: string;
  size: number;
  etag: string;
  md5Hash: string;
  contentType: string;
  bucket: string;
  metadata: Record<string, string>;
}

export interface SignedUploadResult {
  url: string;
  protocol: 'gcs-resumable' | 'put';
  headers?: Record<string, string>;
}
```

## IStorageProvider

```typescript
export interface IStorageProvider {
  readonly type: ProviderType;

  ensureBucket(logicalName: string): void;

  exists(bucket: string, key: string): Promise<boolean>;
  getMetadata(bucket: string, key: string): Promise<FileMetadata>;
  setMetadata(
    bucket: string,
    key: string,
    meta: {
      contentType?: string;
      customTime?: string;
      metadata?: Record<string, string>;
    },
  ): Promise<FileMetadata>;

  signReadUrl(bucket: string, key: string, expiresInSeconds: number): Promise<string>;
  signUploadUrl(
    bucket: string,
    key: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<SignedUploadResult>;

  download(bucket: string, key: string): Promise<Buffer>;
  createReadStream(bucket: string, key: string): Promise<Readable>;
  writeStream(bucket: string, key: string, stream: Readable, contentType: string): Promise<void>;
  writeBuffer(bucket: string, key: string, buffer: Buffer, contentType: string): Promise<void>;

  copy(fromBucket: string, fromKey: string, toBucket: string, toKey: string): Promise<void>;
  move(fromBucket: string, fromKey: string, toBucket: string, toKey: string): Promise<void>;
  delete(bucket: string, key: string): Promise<void>;
  makePublic(bucket: string, key: string): Promise<void>;

  listObjects(
    bucket: string,
    prefix: string,
    opts?: { delimiter?: string; maxResults?: number },
  ): Promise<string[]>;

  consoleUrl(bucketUri: string, key: string): string;
}
```

## File class → provider mapping

| Former GCS usage (conceptually) | Provider API |
|--------------------------------|--------------|
| `bucket.file(id).exists()` | `exists(bucket, key)` |
| `getMetadata()` | `getMetadata(bucket, key)` |
| `setMetadata(meta)` | `setMetadata(bucket, key, meta)` |
| Signed URL read | `signReadUrl(bucket, key, expiry)` |
| Signed resumable upload | `signUploadUrl(...)` → **`SignedUploadResult`** |
| `download()` / streams / save | `download`, `createReadStream`, `writeBuffer`, `writeStream` |
| `copy` / `move` / `delete` / `makePublic` | same names on provider |
| `getFiles({ prefix })` | `listObjects(bucket, prefix, opts)` |

## Design notes

**Flat `bucket` + `key`:** The **`File`** class already has **`bucket`** (**`KnownBuckets`**) and **`id`** (key). The provider resolves **`bucket`** → cloud bucket/container name via **`bucketUriMap`**.

**`SignedUploadResult`:** GCS uses **`gcs-resumable`** (POST init + PUT session); Azure and S3 use **`put`** (single PUT). Clients must branch on **`protocol`** ([03-upload-protocol.md](./03-upload-protocol.md)).

**`writeStream(Readable)`:** Aligns Azure/S3 (read body from stream) with a single pattern; GCS implementation accepts a stream from the caller.

**`setMetadata` and `customTime`:** GCS **`customTime`** and equivalents on other providers are normalized through one **`setMetadata`** shape.
