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
| `./build.sh`  | Remote Docker build on GCP (requires assets already copied; run `npm run build:service` first).   |
| `./deploy.sh` | Deploy current image to Cloud Run (uses `.env`).                                                  |
| `./run.sh`    | Run the local image `task-converter-local` (port 8080).                                           |

## npm scripts (run from this directory)

| Command                 | Description                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm run build:service` | Build `task-converter`, copy `dist/` here, clone `typst-plain/` from GitHub (never overwrites local `package.json` or `package-lock.json`). |
| `npm run build`         | `build:service` then `./build.sh` (full remote image build).                                                                 |
| `npm run deploy`        | `./deploy.sh`                                                                                                                |
| `npm run build:local`   | `build:service` then `docker build -t task-converter-local .`                                                                |
| `npm run dev`           | `build:local` then `./run.sh`                                                                                                |

## Workflow

**Local:** `./local.sh` or `npm run dev` → build package, copy assets, build image, run container.

**Deploy:** From this directory, run `npm run build` (build:service + remote build), then `npm run deploy` (or `./deploy.sh`).

## Environment variables

| Variable      | Description             | Default                     |
| ------------- | ----------------------- | --------------------------- |
| `GCP_PROJECT` | Google Cloud project ID | (required for build/deploy) |
| `GCP_REGION`  | Cloud Run region        | us-central1                 |
| `PORT`        | Local dev port          | 8080                        |

Cloud Run sets `PORT` at runtime; no need to pass it in deploy.

## package-lock.json

This directory has its own `package-lock.json` for reproducible installs in the container (`npm ci`). To regenerate it after changing `package.json`:

```bash
npm install
```

Commit the updated `package-lock.json`.
