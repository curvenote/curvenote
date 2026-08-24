# Local development

This is the canonical guide for bringing up the **SCMS** (sites.curvenote.com) and related local infra. Package-specific notes stay in their READMEs.

**Requirements:** [Bun](https://bun.sh) (`bun@1.3.10`), [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Engine + Compose v2), Node for a few leftover npm-only tools.

Commands below run from the **monorepo root** unless noted.

---

## SCMS — first time

### 1. Config files

Copy local config into `platform/scms/` (gitignored):

- `.app-config.development.yml`
- `.app-config.secrets.development.yml`
- `.env`

Get these from a teammate or a previous checkout. Worktrees copy them automatically (`bun run wt:create`).

The schema is committed at the repo root (`.app-config.schema.yml`). For local extensions, relative paths under `extensions` typically need `../..`.

Also copy the repo-root `.env` if you use one (`DATABASE_URL` for Prisma CLI). Defaults:

| DB   | URL |
| ---- | --- |
| Dev  | `postgresql://journals:curvenote@localhost:5432/journals?statement_cache_size=0` |
| Test | `postgresql://journals:curvenote@localhost:5432/journals_test?statement_cache_size=0` |

### 2. Install and build

```bash
bun install
bun run build
```

`postinstall` generates `platform/scms/package.json` plus extension `client.ts` / `server.ts`.

### 3. Infra (Postgres + MinIO + task-converter)

Default object storage is **local MinIO** (not GCP). Postgres creates `journals` and `journals_test` (user `journals` / password `curvenote`) on port **5432**. MinIO: S3 API **9000**, console **9001**. See [Object storage](#object-storage) to switch to GCP for signing / resumable-upload debugging.

Stop any native Postgres already bound to 5432 first — see [platform/scms/README.md](platform/scms/README.md#moving-from-local-postgres-to-docker-based-postgres).

```bash
bun run dx:reset            # storage:use-minio + dx:up + storage:seed + migrate/seed DB
```

`dx:up` starts Postgres, MinIO, and the task converter, creates buckets, and waits until healthy. `dx:reset` applies the MinIO app-config profile, runs `dx:up`, then `storage:seed`, then `dev:db:reset`.

The **committed seed is bare** (users, roles, queue/cron config — **no sites or works**). Site logos and CDN trees are not in git.

### 4. Optional richer seed (sites + works + assets)

The overlay lives in a separate repo (e.g. `curvenote-seed`). From that repo:

```bash
./copy-into.sh /path/to/curvenote-2
```

Then here:

```bash
bun run dx:reset
```

`storage:seed` (via `dx:reset`) copies `prisma/data/` overlay assets into MinIO. Re-run `dx:reset` after adding site JSON so the DB matches.

### 5. Run the app

```bash
cd platform/scms
bun run dev
```

SCMS listens on **http://localhost:3031** (Vite `host: true`). Converter callbacks use `http://host.docker.internal:3031/v1`.

---

## SCMS — daily

```bash
bun run dx:up          # if containers are down
cd platform/scms
bun run dev
```

Reset DB + re-seed MinIO from the local overlay:

```bash
bun run dx:reset
```

Full infra rebuild (wipe volumes, no-cache rebuild Postgres image with pgmq/pg_net/pg_cron, then reset):

```bash
bun run dx:rebuild
```

---

## Object storage

Two profiles. **MinIO is the default** for local work. Switch to **GCP** only when you need production-like signing or GCS resumable uploads.

| | **MinIO (default)** | **GCP (opt-in)** |
| --- | --- | --- |
| Compose | Postgres + MinIO + task-converter (`bun run dx:up`) | Postgres only (`bun run db:up:gcp`) |
| App config | `api.storage.provider: s3` → `host.docker.internal:9000` | No `api.storage` in development.yml; GCS via `storageSASecretKeyfile` in secrets |
| CDN / reads | Path-style `http://127.0.0.1:9000/…` (buckets public-read locally) | Real `*.curvenote.dev` + `privateCDNSigningInfo` URLPrefix |
| Uploads | S3 **`put`** | **`gcs-resumable`** |
| Data | Local volumes + `prisma/data` overlay | Shared `cdn-*-dev-1` buckets |

Helpers rewrite `platform/scms/.app-config.development.yml` and (for MinIO keys) `.app-config.secrets.development.yml`. They do **not** start Docker or move objects. **Always** `bun run dx:reset` (MinIO) or `bun run dev:db:reset` (GCP) after a flip so seeded `WorkVersion.cdn` hosts match.

### Default: MinIO

Use this for day-to-day SCMS, published-work pages, and converter jobs. Offline, disposable, no shared-dev side effects.

Confirm / apply the profile, then bring the full stack up:

```bash
bun run dx:reset              # storage:use-minio + dx:up + storage:seed + migrate/seed
```

(`storage:use-minio` runs automatically inside `dx:reset` / `dx:rebuild`. Run it alone only when switching back from GCP without resetting.)

MinIO console: http://127.0.0.1:9001 (`curvenote` / `curvenote`). S3 API: http://127.0.0.1:9000. Signing from Docker workers uses `host.docker.internal:9000` (not `127.0.0.1`).

### Switch to GCP (debug / production-like)

Use when you need to debug **Cloud CDN URLPrefix** / `cdn_query`, **GCS resumable uploads**, or behaviour against the shared `cdn-*-dev-1` buckets.

You still need GCS credentials in `platform/scms/.app-config.secrets.development.yml` (`storageSASecretKeyfile`, `privateCDNSigningInfo`). Those stay in secrets; the helper only swaps non-secret `knownBucketInfoMap` / `api.storage`.

```bash
bun run storage:use-gcp
bun run db:up:gcp             # Postgres only; MinIO not required
bun run dev:db:reset          # required — CDN bases in the DB must match GCP
# (prefer this over dx:reset on GCP — dx:reset always starts MinIO + storage:seed)
```

**Caveats:** shared buckets (not offline, not disposable). Do not casually delete objects. No per-developer prefixes.

### Switch back to MinIO

```bash
bun run storage:use-minio
bun run dx:reset              # re-applies MinIO profile + full reset
```

If works still point at `prv.curvenote.dev` after switching to MinIO (or `127.0.0.1:9000` after switching to GCP), the profile flipped but the DB was not reset.

Full detail: [`docs/storage/dx-local.md`](docs/storage/dx-local.md).

---

## Useful commands

| Command | Purpose |
| ------- | ------- |
| `bun run dx:up` | Start Postgres + MinIO + task-converter |
| `bun run dx:reset` | MinIO profile + `dx:up` + MinIO seed overlay + migrate/seed the **dev** DB |
| `bun run dx:rebuild` | No-cache rebuild Postgres image, wipe volumes, bring stack up, MinIO profile, then seed |
| `bun run db:up:gcp` | Postgres only (GCP storage profile) |
| `bun run db:down` | Stop containers (keep volumes) |
| `bun run db:down:clean` | Stop and **delete** Postgres + MinIO volumes |
| `bun run db:logs` | Follow Postgres + MinIO + converter logs |
| `bun run db:rebuild` | Wipe volumes, rebuild Postgres image, bring stack up (no DB seed) |
| `bun run db:rebuild:converter` | Rebuild task-converter image and recreate container |
| `bun run db:studio` | Prisma Studio |
| `bun run storage:use-minio` | Point development + secrets app-config at local MinIO |
| `bun run storage:use-gcp` | Point development app-config at shared GCP |
| `bun run storage:seed` | Copy `prisma/data` overlay → MinIO |
| `bun run storage:smoke` | Optional MinIO PUT smoke test |
| `bun run dev:db:reset` | Migrate reset + seed the **dev** DB (without starting Docker) |
| `bun run test:db:reset` | Migrate reset the **test** DB |
| `bun run wt:create -- <name> [base]` | New git worktree under `../trees/` |

Prefer `dx:reset` / `dx:rebuild` for day-to-day MinIO DX. Always reset after flipping MinIO ↔ GCP so seeded CDN hosts match. See [Object storage](#object-storage).

---

## Local URLs

| What | URL |
| ---- | --- |
| SCMS | http://localhost:3031 |
| MinIO S3 API | http://127.0.0.1:9000 |
| MinIO console | http://127.0.0.1:9001 (`curvenote` / `curvenote`) |
| Task converter | http://127.0.0.1:8080/ |

App-config S3 signing endpoint is `http://host.docker.internal:9000` so Compose workers can use signed URLs.

---

## Further reading

| Topic | Doc |
| ----- | --- |
| Storage profiles, fixtures, GCP switch | [`docs/storage/dx-local.md`](docs/storage/dx-local.md) |
| MinIO compose fragments | [`docker/minio/README.md`](docker/minio/README.md) |
| Job queue (pgmq / pg_net) | [`platform/scms/README.md`](platform/scms/README.md#job-queue-local-development), [`docs/jobs/queues-and-jobs.md`](docs/jobs/queues-and-jobs.md) |
| Task converter | [`services/task-converter/README.md`](services/task-converter/README.md) |
| HTTPS / Caddy | [`platform/scms/README.md`](platform/scms/README.md#development-with-https) |
| Check relay | [`platform/relay/README.md`](platform/relay/README.md) |

---

## Curvenote CLI (local package work)

```bash
bun install
bun run dev          # watch packages
# or
bun run build:cli
```

See the [root README](README.md#development) for versioning (changesets) and Husky hooks.

---

## Git worktrees

```bash
bun run wt:create -- <branch-name> [base-branch]
```

Always prefer creating from `dev` when possible. Worktrees live under `../trees/`. Config (`.app-config.*`, `.env`) is copied from the source checkout. `WT_SKIP_EXTENSIONS=1` skips cloning extension repos.
