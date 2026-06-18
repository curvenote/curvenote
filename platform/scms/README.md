# Curvenote SCMS App

This app is at https://sites.curvenote.com

## Local Development

Copy app-config files, .env into `platform/scms` folder. The app-config schema is committed at the top level of the monorepo, but you will need to edit this to add extensions and fix relative paths, under the `extensions` section (this should just be adding `../..`).

Then at the top level of the monorepo:

```
npm install
```

This installs all the workspace dependencies and the `postinstall` step generates the `platform/scms` package.json with extensions, as well as the `client.ts`/`server.ts` files in the scms extensions source folder.

Still at the top level:

```
npm run build
```

Then in the `platform/scms` folder, to install, build, and run locally:

```
npm install
npm run build
npm run dev
```

### Job queue local development

By default, local development now uses the **supabase provider** (real **pgmq** + **pg_net**) against the Docker Postgres, matching staging/prod. The local Postgres image bundles pgmq, pg_net, and pg_cron (see [`docker/postgres/Dockerfile`](../../docker/postgres/Dockerfile)). On enqueue, a `pg_net` trigger on `pgmq.q_job` wakes **`POST /v1/jobs/push-to-drain`**; the drain config is auto-seeded so the wake (fired from inside the container) reaches the dev server at `host.docker.internal`. Set `QUEUES_PROVIDER=mock` (`.env` only — not app-config) to fall back to the **in-process mock queue** (no pgmq required).

**Queue drain auth:** `api.queueConsumerSecret` in app-config (e.g. `.app-config.secrets.development.yml` locally, staging/prod secrets YAML on deployed envs) secures **`POST /v1/jobs/push-to-drain`**. Job execution still uses the **handshake JWT** inside the queue message.

On deployed environments (`QUEUES_PROVIDER=supabase`, auto when `VERCEL=1`), messages are stored in **Supabase pgmq** and use the same push-to-drain route. A **pg_cron** backup (every minute) calls push-to-drain if the enqueue trigger is missed.

| Mode                   | When                                           | Transport                                             |
| ---------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| **Supabase (default)** | Local dev + deployed SCMS (staging/prod)       | pgmq + `pg_net` enqueue-wake trigger + pg_cron backup |
| **Mock**               | Tests; opt-in locally (`QUEUES_PROVIDER=mock`) | In-memory queue + loopback push-to-drain              |

> After switching to this image you must rebuild the Postgres container: `npm run db:rebuild` (wipes the volume, rebuilds from the Dockerfile, re-runs init), then `npm run dev:db:reset`.

**Staging/prod Supabase setup:** see [`platform/scms/deploy/supabase-job-queue-setup.md`](deploy/supabase-job-queue-setup.md) (pgmq migration, app-config secrets, `_JobQueueDrainConfig`, smoke tests).

### First-time setup

Local development uses **Postgres in Docker** (recommended). The container creates `journals` and `journals_test` with user `journals` / password `curvenote` on port **5432**.

**Requirements:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose v2).

From the **monorepo root**:

```bash
npm run db:up
npm run dev:db:reset
```

`db:up` starts Postgres and waits until it is healthy. `dev:db:reset` runs migrations and seeds the dev database.

Useful commands:

| Command                 | Purpose                           |
| ----------------------- | --------------------------------- |
| `npm run db:up`         | Start Postgres container          |
| `npm run db:down`       | Stop container (keep data volume) |
| `npm run db:down:clean` | Stop and **delete** all DB data   |
| `npm run db:logs`       | Follow Postgres logs              |

Connection strings (same as before):

- Dev: `postgresql://journals:curvenote@localhost:5432/journals?statement_cache_size=0`
- Test: `postgresql://journals:curvenote@localhost:5432/journals_test?statement_cache_size=0`

#### Moving from local Postgres to Docker-based Postgres

If you previously installed Postgres directly on macOS (Homebrew, Postgres.app, or the EnterpriseDB installer), **stop it before starting Docker** — both default to port **5432** and only one can bind it.

**1. Check what is using port 5432**

`brew services` only lists Homebrew-managed daemons — it will **not** show Postgres from the [EnterpriseDB installer](https://www.postgresql.org/download/macosx/) (the one that installs pgAdmin under `/Library/PostgreSQL/…`).

```bash
# Often empty for non-Homebrew installs (server runs as system user "postgres")
lsof -i :5432

# More reliable — shows listeners even when lsof does not
netstat -an | grep 5432

# See the server process (look for /Library/PostgreSQL/… or postgres -D …)
ps aux | grep '[p]ostgres'
```

**2. Stop your existing Postgres**

_Homebrew:_

```bash
brew services list
brew services stop postgresql@16   # use your version, e.g. postgresql@14 or postgresql
```

To prevent Homebrew Postgres from starting on login, leave it stopped (`brew services stop` disables the launch agent).

_Postgres.app:_

Quit the app (menu bar → Postgres → Quit). To avoid autostart, open Postgres.app preferences and disable “Start at login”.

_EnterpriseDB installer (pgAdmin in `/Library/PostgreSQL/17/pgAdmin 4.app`):_

This is a **launchd** service, not Homebrew. It starts at boot (`RunAtLoad`) and pgAdmin connects to it on `localhost:5432`.

```bash
# Stop the server now
sudo launchctl bootout system /Library/LaunchDaemons/postgresql-17.plist

# Optional: prevent it starting again on reboot (adjust version if not 17)
sudo launchctl disable system/postgresql-17
```

To start it again later (e.g. if you need pgAdmin against the old data):

```bash
sudo launchctl enable system/postgresql-17
sudo launchctl bootstrap system /Library/LaunchDaemons/postgresql-17.plist
```

To remove the install entirely (after Docker dev works): open `/Library/PostgreSQL/17/uninstall-postgresql.app`.

**3. Confirm the port is free**

```bash
netstat -an | grep '\.5432.*LISTEN'
# should print nothing
```

**4. Start Docker Postgres and reset schemas**

From the monorepo root:

```bash
npm run db:up
npm run dev:db:reset
npm run test:db:reset   # optional: reset test DB too
```

Your `.env.development` / `.env.test` and app-config database URLs can stay the same (`localhost:5432`, user `journals`, password `curvenote`).

**5. Optional: remove the old native install**

Only after Docker dev is working:

```bash
# Homebrew example — adjust version
brew services stop postgresql@16
brew uninstall postgresql@16

# EnterpriseDB example — use the bundled uninstaller
open /Library/PostgreSQL/17/uninstall-postgresql.app
```

You do **not** need native `psql` for day-to-day dev; use `npm run db:logs`, Prisma Studio (`npm run db:studio`), or `docker compose exec postgres psql -U journals -d journals`.

#### Legacy: native Postgres on macOS

If you cannot use Docker, you can still install Postgres locally ([Prisma macOS guide](https://www.prisma.io/dataguide/postgresql/setting-up-a-local-postgresql-database#setting-up-postgresql-on-macos)) and run:

```bash
sudo -u postgres createuser journals
sudo -u postgres createdb journals
sudo -u postgres createdb journals_test
psql -U postgres -d journals -a -f ./prisma/setup-dev-db.sql
psql -U postgres -d journals_test -a -f ./prisma/setup-test-db.sql
```

For local dev use the password `curvenote`.

### Environment

Make two copies of the `.env.sample` file, called `.env.development` and `.env.test`. (Update the `DATABASE_URL` in each with the respective database connect string `journals` for `development` and `journals_test` for `test`.)

Add your firebase config and secrets to both.

#### Prisma query logging (optional)

To log every Prisma SQL query to the dev server console (useful when tuning loaders or checking N+1 queries), uncomment or add this to your local env file (e.g. `.env.development`):

```
PRISMA_DEBUG_QUERIES=true
```

Accepted values are `true`, `1`, or `yes`. Each query is printed with duration, SQL, and parameters. This flag is **ignored in production** (`NODE_ENV=production`), so it is safe to leave in a local env file.

### Seed

To reset and seed the database for **initial** development work. This needs to be run from the top level.

```
npm run dev:db:reset
npm run dev:db:migrate
```

To only format the schema

```
npm run prisma:format
```

### Development with https

Some development work might need you to run with https locally e.g. ORCID OAuth2 flows. The easiest way to do this is using `caddy`, install caddy on mac using:

```
brew install caddy
```

We have a `Caddyfile` in the repository, so after that run:

```
sudo caddy start
```

And in a separate terminal run the dev server:

```
npm run dev
```

The platform will now be available at:

- http://localhost:3031
- https://127.0.0.1

### Testing

Tests use the `journals_test` database. This is seeded using a different script (`prisma/seed.test.ts`) and can be reset using `npm run test:db:reset`.

Use `npm run test:start` and `npm run test:local` to ensure that tests are started with the correct environment.

## JWT Integration for External Services

The platform provides JWT-based authentication for external service integration. This allows remote services to verify signed tokens issued by our API and enables secure web-hook callbacks and API integrations.

### Overview

- **Algorithm**: RS256 (RSA with SHA-256)
- **Key Format**: JSON Web Key (JWK) per RFC 7517
- **Public Endpoint**: `/v1/keys` serves JWKS for token verification
- **Key Rotation**: Supported via `kid` (Key ID) field

### Configuration Requirements

The JWT integration requires configuration in both the main config and secrets files:

#### Main Config (`.app-config.yml`)

Add to the `api` section:

```yaml
api:
  integrations:
    issuer: https://your-domain.com/v1
    tokenExpiryDuration: 1m
    publicKey:
      kty: RSA
      n: <public key modulus>
      e: AQAB
      use: sig
      alg: RS256
      kid: integration-key-2025-01
```

#### Secrets Config (`.app-config.secrets.yml`)

Add to the `api` section:

```yaml
api:
  integrations:
    privateKey:
      kty: RSA
      n: <same public key modulus>
      e: AQAB
      d: <private key>
      p: <prime factor p>
      q: <prime factor q>
      dp: <d mod (p-1)>
      dq: <d mod (q-1)>
      qi: <q^-1 mod p>
      use: sig
      alg: RS256
      kid: integration-key-2025-01
```

### Generating JWK Keys

To generate new JWK keys for deployment or key rotation, use the provided script:

```bash
# Generate new JWK keys
npm run generate:jwk-keys

# Or run directly
node scripts/generate-jwk-keys.mjs
```

This script will output properly formatted YAML that you can copy directly into your configuration files. The script generates secure 2048-bit RSA keys and includes all necessary JWK fields with a date-based key ID.

### Key Rotation

To rotate JWT keys:

1. **Generate new keys** using `npm run generate:jwk-keys` (automatically generates new `kid` with current date)
2. **Update configuration** with the new keys in both config files
3. **Deploy** the updated configuration
4. **Monitor** external services to ensure they fetch the new public key from `/v1/keys`
5. **Verify** that old tokens are properly rejected after expiry

**Important**: The `kid` field must match between the public and private keys. The generation script automatically creates date-based key IDs (e.g., `integration-key-2025-08-05`).

### External Service Integration

External services can retrieve the public key and verify JWTs using:

```bash
# Fetch public keys
curl https://your-domain.com/v1/keys

# Response format (JWKS):
{
  "keys": [
    {
      "kty": "RSA",
      "n": "...",
      "e": "AQAB",
      "use": "sig",
      "alg": "RS256",
      "kid": "integration-key-2025-01"
    }
  ]
}
```

### Usage Example

```typescript
// Create a token for a specific external service
const token = await createIntegrationToken(
  ctx,
  'external-service-id',
  'https://partner-service.com/api/webhook',
  {
    customClaims: {
      permissions: ['read', 'write'],
      service_type: 'webhook',
    },
    expiryOverride: '5m',
  },
);

// Verify a token (optionally checking audience)
const claims = await verifyIntegrationToken(ctx, token, 'expected-audience');
```

### Security Notes

- **Never commit private keys** to version control
- **Use different keys** for different environments (dev/staging/production)
- **Rotate keys regularly** (recommended: every 90 days)
- **Monitor the `/v1/keys` endpoint** for unusual access patterns
- **Update issuer URLs** to match your production domain
