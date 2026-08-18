# Task-converter – Cloud Run

This directory holds the Dockerfile and scripts to build and deploy the **task-converter** service on Google Cloud Run.

## Build flow

This directory has its **own minimal `package.json`** (and optionally `package-lock.json`): only runtime deps and the `start` script. The task-converter package’s `package.json` is **not** copied here.

The Docker image is built from **pre-built assets** copied here by `build:service` or `local.sh`:

1. Build `packages/task-converter` and copy `dist/` here; check out `typst-plain/` from [github.com/curvenote-themes/typst-plain](https://github.com/curvenote-themes/typst-plain) (never overwrite local `package.json` or `package-lock.json`).
2. Run `docker build` or `gcloud builds submit` from this directory.

Do **not** build the Node app inside the Dockerfile; it only copies what is already in this folder.

## Runtime tools in the image

- **Curvenote CLI** (`@curvenote/cli@latest`)
- **pandoc**
- **unoconv** + **libreoffice-writer** (minimal LibreOffice for docx → PDF and unoconv)
- **typst** (from GitHub release)

## Third-party licenses (MPL compliance)

The image includes **LibreOffice** (Mozilla Public License v2.0). When you distribute this image you must comply with the MPL: the image includes a `NOTICE` file in the working directory with the license and a link to the LibreOffice source code. See [LibreOffice licenses](https://www.libreoffice.org/about-us/licenses/) and `NOTICE` in this directory.

## Setup

```bash
cp .env.sample .env
# Edit .env: set GCP_PROJECT (and optionally GCP_REGION, PORT)
```

## Scripts

| Script        | Description                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------- |
| `./local.sh`  | Build package, copy assets here, build Docker image, then run container (uses `.env` if present). |
| `./build.sh`  | Remote Docker build on GCP (requires assets already copied; run `bun run build:service` first).  |
| `./deploy.sh` | Deploy current image to Cloud Run (uses `.env`).                                                  |
| `./run.sh`    | Run the local image `task-converter-local` (port 8080).                                           |

## Scripts (run from this directory)

| Command                 | Description                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `bun run build:service` | Build `task-converter`, copy `dist/` here, clone `typst-plain/` from GitHub (never overwrites local `package.json` or `package-lock.json`). |
| `bun run build`         | `build:service` then `./build.sh` (full remote image build).                                                                 |
| `bun run deploy`        | `./deploy.sh`                                                                                                                |
| `bun run build:local`   | `build:service` then `docker build -t task-converter-local .`                                                                |
| `bun run dev`           | `build:local` then `./run.sh`                                                                                                |

## Workflow

**Local:** `./local.sh` or `bun run dev` → build package, copy assets, build image, run container.

**Deploy:** From this directory, run `bun run build` (build:service + remote build), then `bun run deploy` (or `./deploy.sh`).

**First-time Pub/Sub setup** (after the Cloud Run service exists): see the `pubsub/` section below.

## Pub/Sub setup (`pubsub/`)

For a new GCP project, wire Pub/Sub push delivery to the deployed Cloud Run service:

```bash
cd pubsub
cp .env.sample .env
# Set PROJECT_ID, PROJECT_NUMBER, PUSH_ENDPOINT (Cloud Run URL), etc.
./pubsub.sh
```

Then configure SCMS for that environment: `converterTopic`, `converterSASecretKeyfile`, and `pubsubProjectId` (see script output and `.app-config.schema.yml`). Use the same `workspace-storage-checks` key for `checkSASecretKeyfile`, `converterSASecretKeyfile`, and `storageSASecretKeyfile`.

The script is idempotent — safe to re-run after redeploys if the Cloud Run URL changes.

If Pub/Sub was set up with a stray invoker SA (e.g. `storage-pubsub`), run `./migrate-to-workspace-storage-checks.sh` (dry-run first, then `CONFIRM=1`).

## Environment variables

| Variable      | Description             | Default                     |
| ------------- | ----------------------- | --------------------------- |
| `GCP_PROJECT` | Google Cloud project ID | (required for build/deploy) |
| `GCP_REGION`  | Cloud Run region        | us-central1                 |
| `PORT`        | Local dev port          | 8080                        |

Cloud Run sets `PORT` at runtime; no need to pass it in deploy.

## Local compose (with `db:up`)

SCMS stack bring-up: **[`DEVELOPMENT.md`](../../DEVELOPMENT.md)**. Default MinIO local DX starts the converter beside Postgres and MinIO:

```bash
bun run db:up                 # builds task-converter-local on first run if missing
bun run db:rebuild:converter  # rebuild image + recreate container
bun run db:logs               # includes task-converter
```

SCMS development already POSTs converter jobs to `http://127.0.0.1:8080/`. Keep `api.tasksCallbackUrl` set to `http://host.docker.internal:3031/v1` so the container can PATCH job status on the host.

## Local: one-off container (without compose)

When SCMS runs on the host (`bun run dev` on port 3031) and the converter runs in Docker, Pub/Sub job attributes must use a host-reachable API URL — not `http://localhost`, which inside the container refers to the container itself.

1. In `platform/scms/.app-config.development.yml`, set `api.tasksCallbackUrl` to `http://host.docker.internal:3031/v1` (see `.app-config.sample.yml` for the field; required for Docker callbacks — without it SCMS falls back to request-derived `localhost` URLs).
2. Run the container with host gateway mapping ( `./local.sh` adds `--add-host=host.docker.internal:host-gateway` ).
3. Ensure SCMS is listening on `3031` (not only via Caddy on port 80).

The converter PATCHes `jobUrl` from the Pub/Sub message (e.g. `http://host.docker.internal:3031/v1/jobs/<id>`). No extra env vars are required in the converter container.

SCMS dev server must allow the `host.docker.internal` Host header (`platform/scms/vite.config.mts` `server.allowedHosts`); otherwise Vite returns 403 to container callbacks.

## package-lock.json

The Docker image still uses npm (`npm ci` + `package-lock.json`) for a minimal runtime install. Host-side build/dev scripts use Bun. To regenerate the lockfile after changing this directory’s `package.json`:

```bash
npm install
```

Commit the updated `package-lock.json`.
