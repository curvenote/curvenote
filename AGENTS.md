# AGENTS.md

## Cursor Cloud specific instructions

This is the **Curvenote** monorepo (npm workspaces + Turborepo). The two runnable
products are the **Curvenote CLI** (`packages/curvenote`) and the **Curvenote SCMS**
web platform (`platform/scms`, a React Router 7 app on port `3031`). Standard build/run
scripts live in the root `package.json` and `platform/scms/package.json`; the SCMS setup
is documented in `platform/scms/README.md`. Notes below are the non-obvious gotchas for
running things in this environment.

### PostgreSQL (required for SCMS, not started automatically)
- The SCMS app and most tests need PostgreSQL. It is installed in the VM but is **not
  started on boot**. Start it each session with:
  `sudo pg_ctlcluster 16 main start`
- Databases: `journals` (dev) and `journals_test` (test); role `journals` / password
  `curvenote`. Dev connection string lives in the root `.env` and
  `platform/scms/.env.development`.

### Local config files (gitignored, required by the SCMS dev server)
The SCMS dev server reads `APP_CONFIG_ENV=development` and needs these **uncommitted**
files in `platform/scms/` (recreate them from the checked-in `.test` variants if missing):
- `.env.development` (copy of `.env.sample`)
- `.app-config.development.yml` (copy of `.app-config.test.yml`)
- `.app-config.secrets.development.yml` (copy of `.app-config.secrets.test.yml`, with
  `journals_test` → `journals` in `databaseUrl`)
The app-config JSON schema lives at the repo root and is referenced via
`VITE_APP_CONFIG_SCHEMA_DIRECTORY='../../'` — do not move it.

### Build before running the SCMS dev server
The dev server imports built workspace packages (`@curvenote/scms-server`,
`@curvenote/scms-db`). After dependencies change, run the root build once before starting
the dev server (it is intentionally **not** in the startup update script because builds are
slow/brittle):
- `npm run build` (root) — builds all workspace packages except `@curvenote/scms`.
- `cd platform/scms && npm run dev` — serves http://localhost:3031.

### Database migrate / seed (Prisma 7 AI guardrail)
Prisma 7 **blocks** `prisma migrate reset` / `db push --force-reset` for AI agents
(requires `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`). On a fresh/empty DB use the
non-destructive path instead:
- `npx prisma migrate deploy --config=./prisma.config.ts` (applies all migrations)
- `npm run dev:db:seed` (seeds users/sites/works/submissions)
Only request user consent for the destructive `reset` if you specifically need to wipe a
populated dev DB.

### Authentication for local testing
UI login uses **Firebase** and fails locally with `auth/invalid-api-key` (placeholder dev
creds) — real Firebase credentials are needed to log in through the browser. For API/e2e
work, mint an HS256 JWT signed with `api.jwtSigningSecret` (`qwerty` in the dev secrets),
with `iss` ending in `/tokens/session` and `sub` = a seeded user id (e.g.
`support@curvenote.com` → `mVkwApbQbKQ0ClO9A8ixYOP74JV2`). The server only checks the
signature + issuer suffix (see `verifySessionToken` / `validateSessionJWT`).

### Lint & test
- `npm run lint` (root, Turbo over all `@curvenote/*` packages).
- `npm run test` (root) runs CLI + package tests. The `curvenote` CLI smoke test
  (`packages/curvenote/test/smoke.spec.ts`) shells out to a globally linked `curvenote`
  binary and can fail in this VM because the global npm prefix is unusual (`node` is
  `/exec-daemon/node` while `npm` is nvm-managed); the CLI itself works when invoked
  directly via `node packages/curvenote/dist/curvenote.cjs`.
- `cd platform/scms && npm run test:unit` runs the SCMS unit tests; integration/e2e suites
  need the `journals_test` DB (use `migrate deploy` + `tsx ../../prisma/seed.test.mts`).
