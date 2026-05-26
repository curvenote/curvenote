# CDN edge signing vs blob signing

**Related:** [07-cdn-signing.md](./07-cdn-signing.md) (Google Cloud CDN implementation)

## Summary

| Layer | Mechanism | Prefix / “folder” |
|-------|-----------|-------------------|
| **Origin** | **`IStorageProvider.signReadUrl(bucket, key)`** — SAS, S3 presigned GET, GCS signed URL | **Per object** |
| **Edge (private CDN)** | **`getSignedCDNQuery`** — HMAC URL-prefix query for **Google Cloud CDN** | **One query string** authorizes HTTP GETs under a **URL prefix** on the CDN host |

Blob signing cannot replace edge prefix signing without **changing the client contract** (e.g. N presigned URLs vs one **`cdn_query`**).

## What works today (GCS CDN)

**`packages/scms-server/src/backend/sign.private.server.ts`:**

- **`privateCDNSigningInfo`** maps CDN bases to HMAC **keyName** / **key**.
- **`getSignedCDNQuery(ctx, baseUrl)`** returns **`URLPrefix=…&Expires=…&KeyName=…&Signature=…`**.
- **`signPrivateUrls`** attaches that query to private asset URLs; results cached (e.g. **NodeCache**).

Downstream APIs can expose a single **`cdn_query`** (e.g. published work DTOs in **`formatSiteWorkDTO`**) so clients append the same query to every path under a work’s CDN prefix.

## Azure / AWS edge (gap)

- **`getSignedCDNQuery`** only implements **Google’s** format. There is **no** CloudFront RSA policy or Azure Front Door token generator in this file.
- If **no** signing key matches, the query is **empty**. A private CDN that **requires** a signature will **403** unless another layer serves authorized URLs.
- Serving private content via **`signReadUrl`** (blob SAS / S3 presigned) **bypasses** the CDN for those URLs and **does not** preserve **“append `cdn_query` to any path”** semantics.

## Why downstream cares

- One signing blob per folder/version vs many per-object URLs.
- Stable **`cdn_query`** + **`cdn`** + **`cdn_key`** URL construction without per-asset API round-trips.
- Cache keys and expiry semantics differ if switching to per-object presigned URLs.

## Possible extensions (not in repo)

**A. Edge parity**

- **CloudFront:** custom **Policy** + RSA signatures, signed **cookies** or URLs; prefix/wildcard **Resource** in policy.
- **Azure Front Door Premium:** token auth / rules engine — product-specific design.

**B. Origin-only private URLs**

- Fully **per-object** SAS/presigned URLs from API — works with **`IStorageProvider`** but breaks single **`cdn_query`** contract.

**C. App proxy**

- Authenticated API streams or redirects bytes — shifts bandwidth/latency to app tier.

## Implementation touchpoints

| Area | Location |
|------|----------|
| CDN query | `sign.private.server.ts` — **`getSignedCDNQuery`**, **`signPrivateUrls`** |
| **`cdn_query` on works** | `backend/loaders/sites/submissions/published/get.server.ts` — **`formatSiteWorkDTO`** |
| DTO fields | `packages/common` — **`HostSpec`**, **`cdn_query`** |

## Open product questions

- Is **query-string-only** required, or are **signed cookies** acceptable for web?
- Must **CLI/native** clients keep **`base + path + '?' + cdn_query`**?
- Multi-mode deployments (migration) vs one signing mode per environment?
- Failure mode when signing is required but keys are missing (fail closed vs telemetry)?

This concern is **independent** of **`IStorageProvider`**: it is **CDN/edge** configuration and optional **API versioning** if clients must change.
