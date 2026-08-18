# Local task-converter Compose Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Start task-converter with `bun run db:up`, building `task-converter-local` only when the image is missing.

**Architecture:** Compose service reuses the existing Cloud Run-style image; a small ensure script gates first-time build; SCMS keeps posting to `127.0.0.1:8080`.

**Tech Stack:** Docker Compose, existing `services/task-converter` Dockerfile / `build:local`, bash ensure script, root `package.json` scripts.

## Global Constraints

- Image name must remain `task-converter-local` (matches `build:local` / `run.sh`).
- Do not auto-rebuild when sources change.
- Do not add converter to `db:up:gcp`.

---

### Task 1: Compose service + ensure script + npm scripts

**Files:**
- Modify: `docker-compose.yml`
- Create: `scripts/ensure-task-converter-image.sh`
- Modify: `package.json` (`db:up`, `db:logs`, add `db:rebuild:converter`)
- Modify: `docs/storage/dx-local.md`, `services/task-converter/README.md`, design already in `docs/superpowers/specs/2026-08-17-local-task-converter-compose-design.md`

- [x] Add `task-converter` service to compose
- [x] Add ensure script (executable)
- [x] Wire package.json scripts
- [x] Update docs
- [x] `docker compose config` validates; commit
