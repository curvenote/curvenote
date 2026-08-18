# Local storage DX (MinIO+6 + GCP switch) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish MinIO-default local object storage with fixture-backed reset, plus a clear documented switch to real shared GCP buckets.

**Architecture:** Default compose stack is Postgres + MinIO; S3 provider talks to MinIO; seed CDN bases come from app-config. Fixtures live under `prisma/data/assets/` (gitignored blobs), pulled from GCP when available and seeded into MinIO. GCP mode is Postgres-only compose + GCS config fragment + existing secrets.

**Tech Stack:** Docker Compose, MinIO, `@aws-sdk/client-s3`, `@google-cloud/storage`, Prisma seed, app-config YAML fragments.

**Spec:** `docs/superpowers/specs/2026-08-14-local-storage-dx-design.md`

## Global Constraints

- Default local DX is MinIO, not fake-gcs-server.
- Do not commit secrets or large blob trees under `prisma/data/assets/` (exception: committed seed placeholder under `pub/00000000-…`).
- Published seed fixtures live under `pub/` (publish job end-state); drafts under `prv/` if needed.
- Switching storage profiles must remind / require DB reset so `WorkVersion.cdn` matches active `knownBucketInfoMap`.
- Real GCP remains shared `cdn-*-dev-1` buckets (no per-dev prefixes).

## Already done on `mnt/local-obj-store`

- [x] MinIO + `minio-init` in `docker-compose.yml`; `db:up` / `db:up:gcp` scripts
- [x] S3 `endpoint` + `forcePathStyle` on `S3StorageProvider`
- [x] Fragments `docker/minio/storage.minio.yml` / `storage.gcp.yml` + short READMEs
- [x] Seed CDN injection via `resolveSeedCdnBase` / `applySeedCdnBase`
- [x] Scripts: `storage:seed`, `storage:smoke` (inventory/pull removed after minimal seed)
- [x] This workspace already has MinIO `api.storage` + MinIO `knownBucketInfoMap` in local `.app-config.development.yml`
- [x] Design locked (this plan’s spec)

## Gap snapshot (2026-08-14)

- Minimal seed: AGU single version + SciPy site (no works); EarthCube removed
- Local mirror: AGU CDN tree under `prisma/data/assets/pub/` (gitignored); seed CDN from `knownBucketInfoMap.pub.cdn`
- `storage:pull` / `storage:inventory` removed — fixture refresh TBD
- Switch helper + DX docs in place; end-to-end reset still to verify after seed settle

---

### Task 1: DX documentation hub

**Files:**

- Create: `docs/storage/dx-local.md`
- Modify: `docker/minio/README.md`
- Modify: `platform/scms/README.md` (First-time setup / GCP opt-out section)
- Modify: `prisma/data/assets/README.md` (point to DX hub + refresh flow)

**Produces:** Canonical switch + fixture docs for all later tasks.

- [x] **Step 1: Write `docs/storage/dx-local.md`** covering:
  - Default bring-up (`db:up` → ensure MinIO config → optional `storage:seed` → `dev:db:reset`)
  - Fixture workflow (`inventory` → `pull` → `seed`)
  - Switch to GCP (`db:up:gcp`, apply `storage.gcp.yml`, secrets already hold SA + `privateCDNSigningInfo`, then `dev:db:reset`)
  - Switch back to MinIO (apply `storage.minio.yml`, `db:up`, `storage:seed`, `dev:db:reset`)
  - Reset/wipe (`db:down:clean`, mirror wipe caveats)
  - Troubleshooting: wrong CDN host in DB, MinIO not running, empty mirror, GCS auth for pull
  - Explicit note: local uploads use S3 `put`; GCS resumable only in GCP profile

- [x] **Step 2: Replace duplicate prose in `docker/minio/README.md` and `platform/scms/README.md` with short summaries + links to `docs/storage/dx-local.md`**

- [x] **Step 3: Commit** (bundled with Task 2)

---

### Task 2: Easy profile switch helper

**Files:**

- Create: `scripts/storage/use-storage-profile.mts`
- Modify: `package.json` (add `storage:use-minio` / `storage:use-gcp` scripts)
- Modify: `docs/storage/dx-local.md` (document the helper)

**Produces:** Dev can flip config fragments without hand-editing YAML.

- [x] **Step 1: Implement `scripts/storage/use-storage-profile.mts`** that:
  - Args: `minio` | `gcp`
  - Target files: `.app-config.development.yml` + `.app-config.secrets.development.yml` (both must exist)
  - Reads `docker/minio/storage.minio.yml` (+ `storage.minio.secrets.yml`) or `storage.gcp.yml`
  - MinIO: non-secret `api.storage` + `knownBucketInfoMap` in development; `accessKeyId`/`secretAccessKey` in secrets
  - GCP: remove `api.storage` from development and secrets so `storageSASecretKeyfile` path wins; replace `knownBucketInfoMap`
  - Prints a clear reminder: run `bun run dev:db:reset` after switch; for MinIO also `db:up` + `storage:seed`

- [x] **Step 2: Add package scripts**

```json
"storage:use-minio": "tsx ./scripts/storage/use-storage-profile.mts minio",
"storage:use-gcp": "tsx ./scripts/storage/use-storage-profile.mts gcp"
```

- [x] **Step 3: Dry-run on a copy or verify with `rg` that knownBucketInfoMap.prv.cdn flips between `127.0.0.1:9000` and `https://prv.curvenote.dev`**

- [x] **Step 4: Commit** (with Task 1)

---

### Task 3: Fixture content — discover what GCP has

**Cancelled:** `storage:pull` / `storage:inventory` removed while minimal seed settles. Revisit fixture refresh later.

### Task 4: Fixture content — make reset consistent

**Deferred:** keep existing local `prisma/data/assets/prv/` mirror for AGU; revisit golden/tarball strategy after seed is happy.

---

### Task 5: Wire reset path + README final pass

**Files:**

- Modify: `package.json` if a convenience script helps (e.g. `dev:storage:reset` = seed minio from mirror — optional)
- Modify: `docs/storage/dx-local.md` — “recommended daily reset” sequence
- Modify: `platform/scms/README.md` — match final commands

**Produces:** One documented happy path for consistent local-dev reset.

- [ ] **Step 1: Document the canonical reset**

```bash
bun run db:up
bun run storage:seed          # no-op if mirror unchanged
bun run dev:db:reset          # migrations + seed; CDN from MinIO config
```

- [ ] **Step 2: Optional** add `"storage:reset": "bun run storage:seed"` only if it clarifies; avoid bloating scripts

- [ ] **Step 3: Verify GCP switch docs** still match helper (`storage:use-gcp` → `db:up:gcp` → `dev:db:reset`)

- [ ] **Step 4: Commit**

```bash
git add docs/storage/dx-local.md platform/scms/README.md package.json
git commit -m "$(cat <<'EOF'
✅ Finalize local storage reset and GCP switch docs

EOF
)"
```

---

### Task 6: Branch hygiene

**Files:** working tree only

- [ ] **Step 1: Decide fate of dirty `bun.lock`** — restore if accidental, or commit if required by dependency changes from this branch
- [ ] **Step 2: `git status` clean except ignored assets**
- [ ] **Step 3: Push / open PR when ready** (not part of local DX unless requested)

---

## Spec coverage check

| Spec requirement                       | Task                  |
| -------------------------------------- | --------------------- |
| MinIO default + fixtures               | Done + Tasks 3–5      |
| Easy GCP switch + docs                 | Tasks 1–2, 5          |
| Consistent local reset with content    | Tasks 3–5             |
| No fake-gcs default / no URLPrefix emu | Honored (docs only)   |
| Don’t commit secrets/blobs             | Tasks 2–4 constraints |

## Placeholder scan

None intentional — Task 4 branches on Task 3 empirical results (A/B/C), which is required because GCP presence is unknown until pull.
