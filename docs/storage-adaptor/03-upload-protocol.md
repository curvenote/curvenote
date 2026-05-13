# Upload protocol

Staging uses **`File.signUpload()`** → **`SignedUploadResult`**. The server returns **`signed_url`** (backwards compatible) and **`upload`** (full result including **`protocol`**) on each **`FileUploadResponse`**.

## Server (`/uploads/stage`)

1. Client sends file metadata to **`/uploads/stage`**.
2. Server checks hashstore for deduplication.
3. For new files, **`File.signUpload({ content_type })`** calls **`provider.signUploadUrl(...)`**.
4. Response items include **`signed_url: result.url`** and **`upload: result`** (see **`packages/scms-server/src/backend/storage/upload.resumable.server.ts`**).

**Types:** **`FileUploadResponse`** / **`SignedUploadInfo`** / **`UploadStagingDTO`** in **`@curvenote/blocks`** and **`@curvenote/common`**.

## GCS — `gcs-resumable`

1. **`initializeUploadSession`**: **`POST`** to the signed URL with **`Content-Type`**, **`x-goog-resumable: start`**.
2. Response: **`Location: sessionUrl`**.
3. **`PUT`** file body to **`sessionUrl`** (progress via XHR).

**Browser:** `packages/scms-core/src/components/upload/utils.ts` — **`handleFileUpload`** uses **`upload?.protocol ?? 'gcs-resumable'`**.

**Tasks:** `packages/scms-tasks/src/uploads.ts` — resumable path with **`Content-Range`** resume on **`308`**.

## Azure — `put` (SAS)

Single **`PUT`** to the SAS URL with body and **`Content-Type`** (and **`x-ms-blob-type: BlockBlob`** where required). No session step.

## S3 — `put` (presigned)

Single **`PUT`** to the presigned URL; **`Content-Type`** must match signing.

## SignedUploadResult

```typescript
type SignedUploadResult = {
  url: string;
  protocol: 'gcs-resumable' | 'put';
  headers?: Record<string, string>;
};
```

| Provider | protocol | Client behavior |
|----------|-----------|-----------------|
| GCS | `gcs-resumable` | POST init → PUT session URL |
| Azure | `put` | PUT to **`upload.url`** (or **`signed_url`**) |
| S3 | `put` | PUT to **`upload.url`** (or **`signed_url`**) |

## Browser helper (pattern)

```typescript
const protocol = upload?.protocol ?? 'gcs-resumable';
if (protocol === 'gcs-resumable') {
  const sessionUrl = await initializeUploadSession(signedUrl, file.type);
  return await performFileUpload(sessionUrl, file, onProgress);
}
const targetUrl = upload?.url ?? signedUrl;
return await performFileUpload(targetUrl, file, onProgress);
```

**`performFileUpload`** (XHR PUT with progress) is shared for session and direct PUT.

## CLI / tasks

- **`packages/scms-tasks/src/uploads.ts`** — `gcs-resumable` vs **`performSimplePutUpload`** for **`put`**.
- **`packages/curvenote-cli/src/uploads/`** — same protocol switch; **`upload`** types re-exported from **`@curvenote/common`** as **`SignedUploadInfo`**.

## Commit payloads

Commit **`/uploads/commit`** must receive **`UploadFileInfo`** only (path, content_type, md5, size). Strip **`signed_url`** and **`upload`** from staged items before commit — they are upload-time credentials only.

## Large files (not implemented as separate protocol)

| Provider | Beyond simple PUT |
|----------|-------------------|
| GCS | Resumable upload (already used for `gcs-resumable`) |
| Azure | Block blob — `stageBlock` / `commitBlockList` |
| S3 | Multipart upload | 

Typical SCMS files stay under **~256MB** Azure block blob limit; extending **`SignedUploadResult`** with a **`multipart`** (or similar) protocol would be a separate change if needed.

## CORS

Each bucket/container needs rules allowing browser **`PUT`**/**`POST`** from app origins, **`Content-Type`**, and for GCS **`x-goog-resumable`** + **`Location`** exposure.

- GCS: e.g. `platform/scms/bucket-cors.json`
- Azure: storage account CORS (Portal or CLI)
- S3: `put-bucket-cors`
