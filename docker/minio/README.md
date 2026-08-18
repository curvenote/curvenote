# Local MinIO object storage

Default local SCMS development uses **MinIO** (S3-compatible) instead of GCP buckets.

SCMS bring-up: **[`DEVELOPMENT.md`](../../DEVELOPMENT.md)**. Storage profiles and fixtures: **[`docs/storage/dx-local.md`](../../docs/storage/dx-local.md)**.

## Quick start

```bash
bun run db:up
bun run storage:use-minio    # if needed
bun run storage:seed         # optional until fixtures exist
bun run dev:db:reset
```

- S3 API (host / browser CDN bases): http://127.0.0.1:9000
- App-config signing endpoint: `http://host.docker.internal:9000` (Compose workers)
- Console: http://127.0.0.1:9001 (`curvenote` / `curvenote`)

Config fragments: [`storage.minio.yml`](./storage.minio.yml) + [`storage.minio.secrets.yml`](./storage.minio.secrets.yml) (default), [`storage.gcp.yml`](./storage.gcp.yml) (opt-in). Prefer `bun run storage:use-minio` / `storage:use-gcp` over hand-merging — MinIO access keys must go in the secrets file.

## GCP opt-in

```bash
bun run storage:use-gcp
bun run db:up:gcp
bun run dev:db:reset
```

Keep GCS credentials and `privateCDNSigningInfo` in secrets. Details in the DX guide.
