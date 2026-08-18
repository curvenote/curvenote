# Local task-converter in Docker Compose

**Date:** 2026-08-17  
**Status:** Approved for implementation

## Goal

Bring the task-converter up with the default local SCMS stack (`bun run db:up`) so converter jobs that SCMS POSTs to `http://127.0.0.1:8080/` reach a running worker without a separate manual `./local.sh`.

## Decisions

| Decision | Choice |
| -------- | ------ |
| Lifecycle | Always-on with default MinIO `db:up` |
| Image source | Existing `task-converter-local:latest` (~2.2 GB) |
| First run | Build image via `services/task-converter` `build:local` if missing |
| Rebuild policy | Only when missing, or via explicit `bun run db:rebuild:converter` |
| GCP profile | `db:up:gcp` stays Postgres-only (no converter) |
| Pub/Sub | Unchanged — development keeps HTTP stub to localhost:8080 |
| Callbacks | Already configured: `api.tasksCallbackUrl: http://host.docker.internal:3031/v1` |

## Design

1. Add a `task-converter` Compose service using `image: task-converter-local`, publish `8080:8080`, `extra_hosts: host.docker.internal:host-gateway`, healthcheck on `GET /`.
2. `scripts/ensure-task-converter-image.sh` — if image absent, run `bun run build:local` in `services/task-converter`.
3. `db:up` runs ensure → `docker compose up -d --wait postgres minio task-converter` → `minio-init`.
4. `db:rebuild:converter` rebuilds the image and recreates the service.
5. Document in local DX + task-converter README.

## Out of scope

- Pub/Sub emulator
- Auto-rebuild when package sources change
- Lighter “stub” converter image
- Changing `db:up:gcp` to include the converter
