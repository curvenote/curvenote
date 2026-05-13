# AWS S3 provider

**Implementation:** `packages/scms-server/src/modules/storage/s3/provider.server.ts`  
**Config type:** `S3StorageConfig` in `modules/storage/types.ts`

## Concept mapping

| SCMS | AWS |
|------|-----|
| Logical bucket | S3 bucket name = **`uri`** from `knownBucketInfoMap` |
| Object key | S3 **Key** |
| Read | Presigned **GET** (`GetObjectCommand` + `getSignedUrl`) |
| Upload | Presigned **PUT** (`PutObjectCommand`), **`protocol: 'put'`** |
| Region | Single **`S3Client`** from **`s3.region`** |

## SDK

- `@aws-sdk/client-s3` — **`S3Client`**, **`GetObjectCommand`**, **`PutObjectCommand`**, **`CopyObjectCommand`**, **`HeadObjectCommand`**, **`ListObjectsV2Command`**, **`DeleteObjectCommand`**, **`PutObjectAclCommand`**, etc.
- `@aws-sdk/s3-request-presigner` — **`getSignedUrl`**

## Presigned URLs

**GET** — query parameters include **`X-Amz-Algorithm`**, **`X-Amz-Credential`**, **`X-Amz-Signature`**, etc.

**PUT** — **`Content-Type`** must match what was signed on **`PutObjectCommand`**.

**Expiry:** IAM user keys: up to **7 days**; STS credentials can be shorter.

## Metadata updates

S3 has no in-place metadata-only update for arbitrary cases the same way — **`setMetadata`** uses **copy-to-self** (`CopyObjectCommand` with **`MetadataDirective: REPLACE`**) where needed.

## `makePublic`

Uses **`PutObjectAclCommand`** with **`public-read`** where allowed. Many buckets **block public ACLs**; bucket policies may be required instead — deployment-specific.

## CloudFront vs S3 origin

**Public traffic** often uses CloudFront in front of S3; **`knownBucketInfoMap`** stores the CDN base in **`cdn`**.

**Private reads** via **`signReadUrl`** hit **S3** (or virtual-hosted–style URL from the presigner), not CloudFront’s RSA signing. CloudFront **signed URLs/cookies** are a different mechanism from S3 presigned URLs — see [07-cdn-signing.md](./07-cdn-signing.md) and [11-cdn-edge-limitations.md](./11-cdn-edge-limitations.md).

## Multipart upload

Not implemented as a dedicated **`SignedUploadResult.protocol`**. Single PUT supports up to **5GB**; larger objects would need multipart orchestration server-side.

## CORS

```json
[
  {
    "AllowedHeaders": ["Content-Type"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedOrigins": ["https://your-app.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

```bash
aws s3api put-bucket-cors --bucket {bucket-name} --cors-configuration file://cors.json
```

## Bucket naming

S3 bucket names are **globally unique**; production names often include org/project prefix.

## Admin

**`consoleUrl`** builds the AWS S3 console object URL for the bucket/key (`region`, **`prefix`** query).
