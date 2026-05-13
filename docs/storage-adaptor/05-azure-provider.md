# Azure Blob Storage provider

**Implementation:** `packages/scms-server/src/modules/storage/azure/provider.server.ts`  
**Config type:** `AzureStorageConfig` in `modules/storage/types.ts`

## Concept mapping

| SCMS | Azure |
|------|--------|
| Logical bucket (`KnownBuckets`) | Container name = **`uri`** from `knownBucketInfoMap` |
| Object key | Blob name (case-sensitive) |
| Read URL | Service SAS, permission **`r`** |
| Upload URL | Service SAS, permissions **`cw`**, **`protocol: 'put'`** |
| Account | **`BlobServiceClient`** from account name + key or **connection string** |

## SAS (Service SAS)

Shared Access Signature query parameters grant time-limited access. Example shape:

```
https://{account}.blob.core.windows.net/{container}/{blob}?sv=...&sig=...
```

**Types:** User Delegation SAS (AAD), Service SAS (account key), Account SAS (broad). The implementation uses **Service SAS** via **`StorageSharedKeyCredential`** and **`generateBlobSASQueryParameters`** — account key on server only.

**Permissions used:**

- **`r`** — `signReadUrl`
- **`cw`** — create + write for **`signUploadUrl`**

**Clock skew:** SAS **`startsOn`** is set **15 minutes** in the past vs **`expiresOn`** (recommended Azure practice).

**Upload headers:** Response may include **`Content-Type`**, **`x-ms-blob-type: BlockBlob`** for block blob PUT.

**Operational notes:** Service SAS cannot be revoked per token except via stored access policies (limited); short TTLs are the main lever. Same reuse semantics as typical signed URLs until expiry.

## SDK

`@azure/storage-blob`: **`BlobServiceClient`**, **`ContainerClient`**, **`BlockBlobClient`**, **`StorageSharedKeyCredential`**, **`generateBlobSASQueryParameters`**, **`BlobSASPermissions`**, **`SASProtocol.Https`**.

**Connection string:** If **`connectionString`** is used, account name and key are parsed for SAS signing; both must be present in the string for the current implementation.

## CDN and private content

**Public:** Azure Front Door (or similar) in front of storage — **`knownBucketInfoMap.*.cdn`** holds the public CDN base; blob path rules depend on routing.

**Private:** **`signReadUrl`** returns a blob URL with SAS — clients may hit storage host directly. This is **origin** signing, not the same as Google Cloud CDN **URL-prefix** signing in **`sign.private.server.ts`**. See [07-cdn-signing.md](./07-cdn-signing.md) and [11-cdn-edge-limitations.md](./11-cdn-edge-limitations.md).

## Upload limits (simple PUT)

Block blob PUT is used for typical sizes. **> ~256MB** may require block list APIs (`stageBlock` / `commitBlockList`) — not exposed as a separate upload protocol in the current **`SignedUploadResult`** contract.

## CORS (browser uploads)

Configure CORS on the storage account for app origins, **`PUT`**, **`GET`**, **`HEAD`**, **`OPTIONS`**, headers including **`Content-Type`**, **`x-ms-blob-type`**, **`x-ms-*`**.

Example (Azure CLI pattern):

```bash
az storage cors add --services b --methods PUT GET HEAD OPTIONS \
  --origins "https://your-app.com" \
  --allowed-headers "Content-Type,x-ms-blob-type,x-ms-*" \
  --exposed-headers "ETag,Content-Length" \
  --max-age 3600 \
  --account-name {accountName}
```

## Admin

**`consoleUrl`** returns an Azure Portal–style deep link for the blob (see implementation for exact URL shape).
