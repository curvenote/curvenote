# Task Converter Service

Node.js server for the task converter, structured for Cloud Run but with **no** Cloud Run build or deployment logic. Use this package to build, run, and link the server locally.

## Build

Produces a single bundled file: `dist/index.js`.

```bash
npm run build
```

## Run

```bash
npm run start
```

Requires `dist/index.js` (run `npm run build` first).

## Local development

```bash
npm run dev
```

Runs `build:watch` and `nodemon` so the server restarts when `dist/index.js` changes.

## Linking in the monorepo

`@curvenote/scms-tasks` is not published to the public registry. From the repo root, the workspace will resolve it when you run `npm install` at the root. To work from this package only:

```bash
cd packages/task-converter && npm install && npm run build && npm run start
```

Or use `npm run dev` from `packages/task-converter` after a root install.

## Environment

Copy `.env.sample` to `.env` and set `PORT` if needed (default `8080`).

## Implementation

The POST handler in `src/service.ts`:

1. Validates body, message, attributes, and data
2. Creates a temp folder under `os.tmpdir()`
3. Validates required attributes (`jobUrl`, `statusUrl`, `handshake`, `successState`, `failureState`, `userId`)
4. Inits `SCMSClient` and decodes base64 message data
5. Leaves a clearly marked section for **converter implementation**
6. On success: removes temp folder, updates submission status, completes the job
7. On error: removes temp folder in `catch`, reports failure via `SCMSClient`

Add converter logic in the marked section in `src/service.ts`; use `tmpFolder` for any temporary files.
