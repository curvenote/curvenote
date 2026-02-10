# Task-converter – Cloud Run

This directory holds the Dockerfile and scripts to build and deploy the **task-converter** service on Google Cloud Run.

## Build flow

The Docker image is built from **pre-built assets** that must be copied here first:

1. Build the task-converter package (`packages/task-converter`).
2. Copy `dist/`, `package.json`, and `typst-plain/` into `services/task-converter/`.
3. Run `docker build` or `gcloud builds submit` from this directory.

Do **not** build the Node app inside the Dockerfile; it only copies what is already in this folder.

## Runtime tools in the image

- **Curvenote CLI** (`@curvenote/cli@latest`)
- **pandoc**
- **unoconv** + **libreoffice-writer** (minimal LibreOffice for unoconv)
- **typst** (from GitHub release)

## Setup

```bash
cp .env.sample .env
# Edit .env: set GCP_PROJECT (and optionally GCP_REGION, PORT)
```

## Scripts

| Script | Description |
|--------|-------------|
| `./local.sh` | Build package, copy assets here, build Docker image, then run container (uses `.env` if present). |
| `./build.sh` | Remote Docker build on GCP (requires assets already copied; run `npm run build:service` first). |
| `./deploy.sh` | Deploy current image to Cloud Run (uses `.env`). |
| `./run.sh` | Run the local image `task-converter-local` (port 8080). |

## npm scripts (run from this directory)

| Command | Description |
|---------|-------------|
| `npm run build:service` | Build `packages/task-converter` and copy `dist/`, `package.json`, `typst-plain/` here. |
| `npm run build` | `build:service` then `./build.sh` (full remote image build). |
| `npm run deploy` | `./deploy.sh` |
| `npm run build:local` | `build:service` then `docker build -t task-converter-local .` |
| `npm run dev` | `build:local` then `./run.sh` |

## Workflow

**Local:** `./local.sh` or `npm run dev` → build package, copy assets, build image, run container.

**Deploy:** From this directory, run `npm run build` (build:service + remote build), then `npm run deploy` (or `./deploy.sh`).

## Environment variables

| Variable | Description | Default |
|----------|-------------|--------|
| `GCP_PROJECT` | Google Cloud project ID | (required for build/deploy) |
| `GCP_REGION` | Cloud Run region | us-central1 |
| `PORT` | Local dev port | 8080 |

Cloud Run sets `PORT` at runtime; no need to pass it in deploy.
