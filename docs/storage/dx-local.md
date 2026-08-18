# Local object storage DX

Default local SCMS development uses **MinIO** (fully local). You can switch to the previous **shared GCP/GCS + Cloud CDN** setup when you need production-like signing or GCS resumable uploads.

**Design:** [`docs/superpowers/specs/2026-08-14-local-storage-dx-design.md`](../superpowers/specs/2026-08-14-local-storage-dx-design.md)

## Profiles

| Profile             | Compose          | App storage                                                            | CDN / private reads                                         | Upload protocol     |
| ------------------- | ---------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------- |
| **MinIO** (default) | Postgres + MinIO + task-converter | `api.storage.provider: s3` → `127.0.0.1:9000` | Path-style MinIO HTTP URLs; CDN bases stay `127.0.0.1:9000`  | S3 **`put`**        |
| **GCP** (opt-in)    | Postgres only                     | Secrets `storageSASecretKeyfile` (no `api.storage` in development.yml) | Real `*.curvenote.dev` + `privateCDNSigningInfo` URLPrefix  | **`gcs-resumable`** |

Fragments: [`docker/minio/storage.minio.yml`](../../docker/minio/storage.minio.yml), [`docker/minio/storage.gcp.yml`](../../docker/minio/storage.gcp.yml).

## Default bring-up (MinIO)

Full SCMS steps (config, install, seed overlay): **[`DEVELOPMENT.md`](../../DEVELOPMENT.md)**.

```bash
bun run db:up
bun run storage:use-minio          # if config is not already on MinIO
bun run storage:seed               # optional until prisma/data has an overlay
bun run dev:db:reset
```

- S3 API / signing endpoint (host + browser): http://127.0.0.1:9000
- Compose workers cannot use `127.0.0.1` (that is the container itself). Converter downloads should use the `minio` service hostname or `host.docker.internal:9000` from inside Docker.
- Console: http://127.0.0.1:9001 (`curvenote` / `curvenote`)
- Task converter: http://127.0.0.1:8080/ (built on first `db:up` if `task-converter-local` is missing; rebuild with `bun run db:rebuild:converter`)
- Seeded `WorkVersion.cdn` values come from `api.knownBucketInfoMap.pub.cdn` in app-config (published works live on the public bucket).

## Fixture mirror

Gitignored blobs live under [`prisma/data/assets/`](../../prisma/data/assets/). Place **published** CDN trees under `pub/{cdn_key}/` (and drafts under `prv/` if needed). Place **site logos / favicons** under `static/site/{name}/` (seeded into the main CDN bucket as `static/...`):

```bash
bun run storage:seed        # prv/ → private, pub/ → public, static/ → CDN
bun run storage:smoke       # optional PUT smoke test
```

Daily reset once the mirror has the trees you need:

```bash
bun run db:up
bun run storage:seed
bun run dev:db:reset
```

Site/work JSON and CDN trees are **not** committed. Copy a richer overlay (e.g. `curvenote-seed` `copy-into.sh`) into the checkout, then `storage:seed` + `dev:db:reset`. See [`DEVELOPMENT.md`](../../DEVELOPMENT.md).

## Switch to real GCP

Use when you need GCS resumable uploads or Cloud CDN URLPrefix / `cdn_query` against shared `cdn-*-dev-1` buckets.

```bash
bun run storage:use-gcp
bun run db:up:gcp              # Postgres only; MinIO not required
bun run dev:db:reset           # required — DB CDN bases must match GCP
```

Secrets stay as-is: `storageSASecretKeyfile` and `privateCDNSigningInfo` in `.app-config.secrets.development.yml`.

**Caveats:** shared buckets (not offline, not disposable), do not casually delete objects, no per-developer prefixes.

## Switch back to MinIO

```bash
bun run storage:use-minio
bun run db:up
bun run storage:seed
bun run dev:db:reset           # required — DB CDN bases must match MinIO
```

## Profile helper

```bash
bun run storage:use-minio
bun run storage:use-gcp
```

These edit `platform/scms/.app-config.development.yml` and (for MinIO keys) `.app-config.secrets.development.yml`:

- **minio** — set non-secret `api.storage` + MinIO `knownBucketInfoMap`; put `accessKeyId` / `secretAccessKey` in secrets
- **gcp** — remove `api.storage` from development and secrets (legacy `storageSASecretKeyfile` path) + GCP `knownBucketInfoMap`

They do **not** start Docker, touch secrets, or move objects. Always `dev:db:reset` after a flip so seeded CDN hosts match.

## Reset / wipe

| Command                                       | Effect                                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `bun run db:down`                             | Stop containers; keep volumes                                                                |
| `bun run db:down:clean`                       | Stop and **delete** Postgres + MinIO volumes                                                 |
| Delete `prisma/data/assets/prv/*` and `pub/*` | Wipe local fixture mirror (keep committed placeholder under `pub/00000000-…` if you need it) |

## Troubleshooting

| Symptom                                                             | Likely cause                                                                             |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Works point at wrong host (`prv.curvenote.dev` vs `127.0.0.1:9000`) | Switched profile without `dev:db:reset`                                                  |
| Uploads fail to MinIO                                               | `db:up` not run, or still on GCP profile                                                 |
| Uploads fail with `getaddrinfo ENOTFOUND host.docker.internal` | S3 `endpoint` still `host.docker.internal` — the host Node process cannot resolve that name. Use `http://127.0.0.1:9000`. |
| Converter cannot download/upload (ECONNREFUSED `127.0.0.1:9000`)    | Signed URLs were minted for the host. From Compose, use `minio:9000` or `host.docker.internal:9000`, not `127.0.0.1`. |
| Empty CDN / 404 after reset                                         | Mirror empty under `prisma/data/assets/pub/` (published) — add trees then `storage:seed` |
| Private CDN signing in MinIO mode                                   | Expected empty/`cdn_query` no-op; buckets are public-read locally                        |

## Related

- [`docker/minio/README.md`](../../docker/minio/README.md)
- [`docs/storage-adaptor/03-upload-protocol.md`](../storage-adaptor/03-upload-protocol.md)
- [`docs/storage-adaptor/07-cdn-signing.md`](../storage-adaptor/07-cdn-signing.md)
