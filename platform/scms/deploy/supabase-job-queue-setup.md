# Supabase job queue setup (pgmq)

SCMS job dispatch stores messages in **Postgres** using the **pgmq** extension (queue name: `job`). On enqueue, a **`pg_net` database trigger** on the queue table wakes **`POST /v1/jobs/push-to-drain`** over HTTP — the wake is fired by Postgres, not the app. A **pg_cron** job in the database calls the same URL once per minute as a backup.

> **Important:** because the wake comes from the database, **`"_JobQueueDrainConfig"` (Step 4) is required** — not just for the backup. If it is empty, neither the enqueue trigger nor pg_cron will wake the consumer and jobs will sit in the queue. (Local dev uses the `mock` provider, which self-wakes from the app and does not need this.)

Do these steps **once per Supabase project** (staging and production are separate projects → repeat everything for each).

---

## What you configure (three places)

| Where | What |
|---|---|
| **Supabase Postgres** | pgmq extension, queue `job`, pg_cron backup row |
| **App-config secrets** (per env) | `api.url`, `api.databaseUrl`, `api.queueConsumerSecret` |
| **Vercel** (optional) | `QUEUES_PROVIDER` — usually **not needed** (see below) |

---

## Step 1 — Enable pgmq in Supabase

1. Open the [Supabase Dashboard](https://supabase.com/dashboard) for the project (staging **or** prod — do not mix them up).
2. Go to **Integrations** → **Queues** (or **Database** → **Extensions** and search for `pgmq`).
3. Enable / install **pgmq** if it is not already enabled.

If you skip this, `CREATE EXTENSION pgmq` in the Prisma migration may fail.

---

## Step 2 — Run the database migration

Two migrations set this up:

`20260616190000_add_pgmq_job_queue` creates:

- `pgmq` extension + queue `job`
- `"_JobQueueDrainConfig"` table (drain URL + secret)
- `pg_cron` / `pg_net` extensions, `job_queue_cron_drain()`, and the `job-queue-drain-backup` schedule (if available)

`20260617120000_add_pgmq_enqueue_wake_trigger` creates:

- an `AFTER INSERT` trigger on `pgmq.q_job` that calls `job_queue_cron_drain()` so **enqueue wakes are fired by the database** via `pg_net` (skipped if pgmq / pg_net are unavailable)

**Normal path:** CI runs `prisma migrate deploy` when you push to `dev` (staging DB) or `main` (prod DB). Confirm that workflow succeeded for your deploy.

**Manual path** (only if CI did not run or failed):

```bash
# From monorepo root, with DATABASE_URL pointing at the Supabase direct connection string
DATABASE_URL='postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres' \
  npx prisma migrate deploy --config=./prisma.config.ts
```

**Verify migration applied** — in Supabase **SQL Editor**, run:

```sql
-- Extensions present?
SELECT extname FROM pg_extension WHERE extname IN ('pgmq', 'pg_cron', 'pg_net');

-- Queue exists? (returns one row with queue_name = job)
SELECT * FROM pgmq.metrics('job');

-- Backup cron scheduled? (may be empty until Step 4 config row exists; job row should exist)
SELECT jobid, jobname, schedule, command FROM cron.job WHERE jobname = 'job-queue-drain-backup';

-- Enqueue wake trigger present? (returns one row)
SELECT tgname FROM pg_trigger WHERE tgname = 'pgmq_job_enqueue_wake_trigger';
```

Expected:

- `pgmq` in the extension list
- `pgmq.metrics('job')` returns a row (queue length may be `0`)
- `job-queue-drain-backup` appears under `cron.job` on Supabase (if `pg_cron` installed)
- `pgmq_job_enqueue_wake_trigger` appears under `pg_trigger`

---

## Step 3 — App-config secrets (per environment)

In the **app-config secrets YAML for that environment** (staging secrets file, production secrets file, etc.), set:

### `api.url`

The **public base URL** of SCMS for that environment, **no trailing slash**.

Examples:

- Staging: `https://scms.curvenote.dev`
- Production: `https://scms.curvenote.com`

Used when the app wakes push-to-drain after enqueue (`{api.url}/v1/jobs/push-to-drain`).

### `api.databaseUrl`

The Supabase Postgres connection string the app uses at runtime (pooler URL with `?pgbouncer=true` if you use transaction pooling — same as today).

### `api.queueConsumerSecret`

A long random secret (e.g. 64+ hex chars from `openssl rand -hex 32`). **Same value** must be used in Step 4 for the pg_cron backup.

Generate one:

```bash
openssl rand -hex 32
```

Add under `api:` in secrets YAML:

```yaml
api:
  url: 'https://scms.curvenote.dev'   # example — use your env’s host
  queueConsumerSecret: '<paste generated secret here>'
  databaseUrl: 'postgresql://...'     # existing Supabase URL
  # ... other required api fields unchanged
```

Redeploy SCMS after changing secrets so the running app picks them up.

---

## Step 4 — Populate `"_JobQueueDrainConfig"` (REQUIRED — primary wake)

This table tells the **database** how to call push-to-drain. It is used by **both** the enqueue trigger (primary wake) and the once-per-minute backup cron. It is **not** app-config; it lives only in Postgres.

> **This step is mandatory, not optional.** The app no longer self-wakes push-to-drain on enqueue when using the supabase provider — the database does. If this row is missing/empty, enqueued jobs will not drain (the trigger and cron both no-op).

> **Easiest option: use the admin UI.** Once SCMS is deployed, system admins can open **System → Jobs → Queues tab** (`/app/system/jobs?tab=queues`) and use **Push secret from app-config** (writes `api.queueConsumerSecret` into the row) and **Save endpoint** (sets `drain_url`). That tab also shows whether the stored secret matches app-config and a live tail of pending/in-flight pgmq messages. The SQL below remains available for first-time setup or environments without UI access.

1. Supabase Dashboard → **SQL Editor** → **New query**.
2. Replace the placeholders below with **this environment’s** values:
   - `DRAIN_URL` = `{api.url}` + `/v1/jobs/push-to-drain`
   - `DRAIN_SECRET` = **exactly** the same string as `api.queueConsumerSecret` from Step 3

**Staging example** (adjust host and secret):

```sql
INSERT INTO "_JobQueueDrainConfig" (id, drain_url, drain_secret)
VALUES (
  1,
  'https://scms.curvenote.dev/v1/jobs/push-to-drain',
  'paste-the-same-queueConsumerSecret-from-app-config-here'
)
ON CONFLICT (id) DO UPDATE
SET
  drain_url = EXCLUDED.drain_url,
  drain_secret = EXCLUDED.drain_secret;
```

3. Click **Run**.
4. Confirm:

```sql
SELECT id, drain_url, length(drain_secret) AS secret_length FROM "_JobQueueDrainConfig";
```

You should see one row, `id = 1`, correct URL, and a non-zero `secret_length`.

**Common mistakes**

- Trailing slash on URL (`...com/v1/...` not `...com//v1/...`) — use `api.url` without trailing slash, then append `/v1/jobs/push-to-drain`.
- Secret mismatch — cron sends `Bearer <drain_secret>`; app compares to `api.queueConsumerSecret`. They must match **character for character**.
- Staging secret in prod database (or vice versa) — each Supabase project has its own table; use that env’s URL and secret.
- Forgetting to redeploy after changing `queueConsumerSecret` in app-config — old app instances would reject cron’s Bearer token.

---

## Step 5 — Smoke test

### 5a. push-to-drain responds (no job required)

From your machine:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  -X POST 'https://scms.curvenote.dev/v1/jobs/push-to-drain' \
  -H "Authorization: Bearer YOUR_queueConsumerSecret" \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Expected: **`202`**.  
`401` → wrong secret or app not redeployed with new app-config.  
`404` → wrong URL or route not deployed.

### 5b. End-to-end job (optional)

1. Log in as platform admin → **System → Jobs**.
2. Dispatch a loopback test job.
3. In SQL Editor:

```sql
SELECT * FROM pgmq.metrics('job');
```

Queue length should return to `0` after the job runs. Check app logs for `[processJobMessage]` / job completion.

---

## Deploy order (do not get this wrong)

1. **Migration on the database first** (Step 1–2) — pgmq extension and queue `job` must exist.
2. **App-config + `_JobQueueDrainConfig`** (Step 3–4).
3. **Deploy application code** that uses the Supabase queue provider.

If the app runs the **supabase** provider against a database that has **not** had the migration applied, **`pgmq.send` will fail** at enqueue time and jobs will not dispatch.

---

## What is `QUEUES_PROVIDER`? Why is it an env var?

`QUEUES_PROVIDER` is a **runtime environment variable** (`.env` locally, Vercel **Environment Variables** in the dashboard). It is **not** in app-config.

It selects which queue backend `dispatchJob` uses:

| Value | Behavior |
|---|---|
| `mock` | In-memory queue (local dev / tests) |
| `supabase` | `pgmq.send` / `pgmq.read` against Postgres |

**Resolution order** (see `queueProviders/index.server.ts`):

1. If `QUEUES_PROVIDER` is set to `mock` or `supabase` → use that.
2. Else if `VERCEL=1` (automatic on Vercel) → **`supabase`**.
3. Else if `NODE_ENV` is `development` or `test` → **`mock`**.
4. Else → **`supabase`**.

So on **Vercel staging/production you usually do not set `QUEUES_PROVIDER` at all** — Vercel sets `VERCEL=1`, and the app picks `supabase` automatically.

Why keep the env var?

- **Local dev:** default `mock` without Supabase/pgmq installed.
- **Override:** force `QUEUES_PROVIDER=supabase` on a non-Vercel host or to test pgmq locally.
- **Emergency:** force `QUEUES_PROVIDER=mock` on a deployment (not recommended for prod).

The old doc line *“Deploy app code that sets `QUEUES_PROVIDER=supabase` before the pgmq migration…”* means:

> Do **not** deploy a build that will **use the supabase provider** (whether via `QUEUES_PROVIDER=supabase` **or** via `VERCEL=1`) until the **database** has pgmq installed.

The variable name is incidental — **any** configuration that makes the app call `pgmq.*` before migration is the problem, not the env var itself.

---

## How dispatch works (reference)

```
enqueueAndDispatchJob
  → pgmq.send('job', { job_id, job_type, handshake })       -- INSERT into pgmq.q_job
  → pgmq_job_enqueue_wake_trigger → job_queue_cron_drain()  -- DB-fired wake
  → net.http_post(drain_url)  POST /v1/jobs/push-to-drain  (Bearer drain_secret)
  → 202 + background drain of one message
  → if queue depth > 0, app wakes again (notifyQueueConsumer)

Backup (every minute): pg_cron → job_queue_cron_drain() → net.http_post(drain_url)

Both the trigger and cron no-op until "_JobQueueDrainConfig" row exists (Step 4).
```

Primary path is the **database enqueue trigger** (`pg_net`). pg_cron is a safety net only — do not rely on it as the main drain mechanism. (Local dev’s `mock` provider self-wakes from the app instead.)

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Migration fails on `CREATE EXTENSION pgmq` | Enable pgmq in Supabase Dashboard (Step 1) |
| Jobs stuck QUEUED, no handler logs | Empty `"_JobQueueDrainConfig"` (Step 4) — the DB trigger/cron can't wake push-to-drain; or trigger missing (check `pg_trigger`), or secret/url wrong |
| push-to-drain returns 401 | `drain_secret` in `"_JobQueueDrainConfig"` ≠ app `queueConsumerSecret`, or app-config not redeployed |
| Cron never wakes / trigger never wakes | Empty `"_JobQueueDrainConfig"` — complete Step 4 |
| `pgmq.send` error in logs | Migration not applied on **this** database, or wrong `databaseUrl` |

Further design detail: [`docs/superpowers/specs/2026-06-16-job-manager-pgmq-design.md`](../../../docs/superpowers/specs/2026-06-16-job-manager-pgmq-design.md).
