# Local storage DX — MinIO default + GCP opt-in

**Date:** 2026-08-14  
**Branch:** `mnt/local-obj-store`  
**Status:** Approved

## Goal

Local SCMS development uses **fully local object storage** by default (Docker Compose MinIO + a fixture mirror), with an **easy, documented switch** back to the previous **real shared GCP/GCS + Cloud CDN** setup when a developer needs production-like signing or resumable-upload behavior.

## Decision

| Profile              | Default? | Storage                                     | CDN / private reads                                                      |
| -------------------- | -------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| **MinIO + fixtures** | Yes      | S3 provider → local MinIO                   | Path-style HTTP CDN bases; CDN buckets public-read locally; no URLPrefix |
| **Real GCP**         | Opt-in   | GCS provider → shared `cdn-*-dev-1` buckets | Real `*.curvenote.dev` CDN + `privateCDNSigningInfo` URLPrefix           |

**Out of scope:** fake-gcs-server as default, emulating Cloud CDN URLPrefix locally, per-developer GCS prefixes/buckets.

## Default profile (MinIO + fixtures)

1. `bun run db:up` starts Postgres + MinIO + bucket init.
2. App-config uses `api.storage.provider: s3` with MinIO endpoint / `forcePathStyle` and MinIO `knownBucketInfoMap` CDN bases (`http://127.0.0.1:9000/...`).
3. Seed injects `WorkVersion.cdn` from `api.knownBucketInfoMap.pub.cdn` (published end-state; drafts would use `prv`).
4. Upload protocol exercised locally: S3 **`put`** (not GCS resumable).
5. Fixture mirror at `prisma/data/assets/` (blobs gitignored); `storage:seed` copies into MinIO. Refresh/expand of that mirror is TBD (pull/inventory helpers removed for now).
6. Consistent reset: wipe/recreate DB + re-seed MinIO from the local mirror (no cloud required after fixtures exist).

## GCP profile (legacy shared-dev)

1. `bun run db:up:gcp` starts Postgres only.
2. App-config uses GCS-shaped `knownBucketInfoMap` (fragment `docker/minio/storage.gcp.yml`) and existing secrets (`storageSASecretKeyfile` / optional explicit `api.storage.provider: gcs`, plus `privateCDNSigningInfo`).
3. Upload protocol: **`gcs-resumable`** against real GCS; private reads use real Cloud CDN URLPrefix.
4. Caveats (documented): shared data, not offline, do not casually delete objects, flip requires CDN bases in DB to match — prefer `dev:db:reset` after switching.

## Switch UX

- Keep YAML fragments: `docker/minio/storage.minio.yml` and `docker/minio/storage.gcp.yml`.
- Single DX doc (`docs/storage/dx-local.md`) with bring-up, fixture workflow, **switch to GCP**, **switch back to MinIO**, reset/wipe, troubleshooting.
- Short pointers from `platform/scms/README.md` and `docker/minio/README.md`.
- Optional light helper (e.g. print/apply overlay checklist) — must not commit secrets; after flip, remind to reset DB so seeded CDN hosts match.

## Fixture content strategy

- Minimal seed currently: AGU single-version work with known local CDN tree; SciPy site without works; EarthCube removed.
- How to refresh/expand `prisma/data/assets/` is TBD (no `storage:pull` / `storage:inventory` for now).
- Blobs stay gitignored.

## Success criteria

- New clone can run MinIO path without GCP credentials once a fixture mirror is present (or after maintainer-provided fixtures).
- Dev can switch to real GCS + CDN signing using docs alone in &lt;10 minutes.
- Switch back to MinIO leaves a freshly reset DB pointing at MinIO CDN bases.
- `storage:seed` loads local fixtures into MinIO while in MinIO mode.
