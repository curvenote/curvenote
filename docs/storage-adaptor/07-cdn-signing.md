# Private CDN signing (Google Cloud CDN)

**Implementation:** `packages/scms-server/src/backend/sign.private.server.ts`

This document describes **edge** URL signing for **private** CDN traffic. It is **separate** from **`IStorageProvider.signReadUrl`** (origin / blob). For parity limits on Azure/AWS CDNs and **`cdn_query`**, see [11-cdn-edge-limitations.md](./11-cdn-edge-limitations.md).

## Behavior

1. **`privateCDNSigningInfo`** in app config maps CDN hostnames (or URL prefixes matched by substring) to keys: **`keyName`**, base64 **`key`** (HMAC).

2. **`getSignedCDNQuery(ctx, baseUrl)`** produces a **Google Cloud CDN** URL-prefix policy string:
   - **`URLPrefix=`** base64url(**`baseUrl`**)
   - **`Expires=`** Unix time (implementation uses ~24h from generation time)
   - **`KeyName=`** key name
   - **`Signature=`** base64url(HMAC-SHA1(policy, key))

3. **`signPrivateUrls`** appends this query string to thumbnail, social, and config asset URLs for private sites. Results are cached (e.g. **`NodeCache`**, ~12h TTL).

## Policy format (GCS Cloud CDN)

```
URLPrefix={base64url(baseUrl)}&Expires={unix}&KeyName={keyName}&Signature={base64url(hmac_sha1(policy, key))}
```

This format is **specific to Google Cloud CDN**, not generic HMAC.

## Azure Front Door / AWS CloudFront

- **Azure Front Door Standard:** no built-in equivalent to the above HMAC URL-prefix signing.
- **Azure Front Door Premium:** token / rules engine — different configuration and token shape.
- **CloudFront:** RSA **key groups**, **signed URLs** or **signed cookies**, custom **Policy** JSON — can scope paths/prefixes but **not** the same algorithm as **`getSignedCDNQuery`**.

When **`getSignedCDNQuery`** finds **no** matching **`privateCDNSigningInfo`** entry for the CDN base URL, it returns an **empty** string. Private assets then rely on **other** mechanisms (e.g. **SAS** / **S3 presigned GET** from **`signReadUrl`**) if wired in product code — which **does not** replicate **`cdn_query`** “one query for whole prefix” semantics.

## Data model

Stored **`WorkVersion.cdn`** / keys are unchanged. Only **runtime** URL construction differs: GCS CDN deployments may append the signed query; other stacks may resolve private assets differently.
