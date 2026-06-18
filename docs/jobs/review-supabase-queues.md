# Code Tour — `mnt/supabase-queues`

> Review guide for the branch that replaces the internal job-dispatch transport
> with **Supabase pgmq** + a database-fired (`pg_net`) drain wake. Read top to
> bottom; each step links to the exact code to review.

**Design spec:** [`docs/superpowers/specs/2026-06-16-job-manager-pgmq-design.md`](../superpowers/specs/2026-06-16-job-manager-pgmq-design.md)
**Changeset:** [`.changeset/pgmq-job-dispatch.md`](../../.changeset/pgmq-job-dispatch.md)

---

## What changed, in one paragraph

The internal job dispatch transport moved from `@vercel/queue` to **Supabase
pgmq** (a Postgres-backed queue) as the **single transport** — there is no
provider abstraction and no mock/in-memory queue. Enqueue is `pgmq.send`;
draining happens via `POST /v1/jobs/push-to-drain` which reads **one** message
and runs it in the background. The big architectural shift is the **wake**:
Postgres itself fires it — an `AFTER INSERT` `pg_net` trigger on `pgmq.q_job`
calls push-to-drain, so the app does not self-call after enqueue. `pg_cron` is a
once-per-minute backup. Messages that exhaust their delivery attempts are
**dead-lettered** (archived to `pgmq.a_job` + job marked `FAILED`). Local dev
runs the **real** pgmq/pg_net stack via a custom Docker Postgres image (required,
no fallback). A **Queues** admin tab manages the DB-side drain config
(`_JobQueueDrainConfig`) and tails the queue.

---

## 1. The pgmq queue module (start here)

There is no provider interface anymore — a single module owns the pgmq queue.
Read its types and entry points first.

[`packages/scms-server/src/backend/jobs/enqueue/pgmq/types.ts`](../../packages/scms-server/src/backend/jobs/enqueue/pgmq/types.ts) — `JobQueueMessage`, `QueueReadResult` (carries the pgmq `msgId: bigint`), `QueuePeekEntry`.

[`packages/scms-server/src/backend/jobs/enqueue/pgmq/jobQueue.server.ts`](../../packages/scms-server/src/backend/jobs/enqueue/pgmq/jobQueue.server.ts) exports plain functions: `sendJobMessage`, `readOneJobMessage`, `ackJobMessage`, `getJobQueueDepth`, `peekJobQueue`, plus `PGMQ_JOB_QUEUE_NAME` / `PGMQ_VISIBILITY_TIMEOUT_SECONDS`.

Key concepts for the rest of the tour:
- **`msgId`** — the pgmq message id returned by `readOneJobMessage` and passed back to `ackJobMessage`.
- **dead-lettering** lives inside `readOneJobMessage` (see §2) — no separate `nack`.
- **`peekJobQueue`** — read-only monitoring, separate from the consume path.

---

## 2. The pgmq queue (send, read+DLQ, ack)

### 2a. Idempotent send

[`pgmq/jobQueue.server.ts` → `sendJobMessage`](../../packages/scms-server/src/backend/jobs/enqueue/pgmq/jobQueue.server.ts)

```Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${options.idempotencyKey}))`
Prisma.sql`SELECT pgmq.send(${PGMQ_JOB_QUEUE_NAME}, ${message}::jsonb) AS send
           WHERE NOT EXISTS (
             SELECT 1 FROM pgmq.q_job WHERE message ->> 'job_id' = ${options.idempotencyKey}
           )`
```

- A **transaction-scoped advisory lock** keyed on `job_id` serializes concurrent sends for the same job, making the check-then-insert atomic.
- Dedup scans `pgmq.q_job` for an existing message with the same `job_id` — it only dedups messages **still in the queue**; a job already drained + re-enqueued is allowed (intended).

### 2b. Read + dead-letter

`readOneJobMessage` uses `pgmq.read(queue, 300, 1)` (visibility `300s`, `qty=1`) in a loop. When a message's `read_ct` exceeds `MAX_JOB_QUEUE_DELIVERY_ATTEMPTS`, it is **dead-lettered** (archived to `pgmq.a_job` via `pgmq.archive`, then handled via `handleTransportFailure`, including `JOB_FAILED_DEFAULT` cleanup when appropriate) and skipped, so a poison message can never block the queue or be redelivered forever. `ackJobMessage` = `pgmq.delete`. There is no `nack`: on consumer failure the message is simply left leased and redelivered after the visibility timeout (incrementing `read_ct`).

### 2c. Peek (monitoring)

`peekJobQueue` reads `pgmq.q_job` directly so in-flight (leased) messages show up without consuming.

---

## 3. Enqueue → dispatch → wake

### 3a. `enqueueAndDispatchJob` (entry point, unchanged shape)

[`enqueue/enqueueAndDispatchJob.server.ts`](../../packages/scms-server/src/backend/jobs/enqueue/enqueueAndDispatchJob.server.ts#L20-L115) — inserts the `QUEUED` row (+ any `BLOCKED` dependents) in a transaction, mints the handshake JWT, then calls `dispatchJob`. The queue swap is invisible here.

### 3b. `dispatchJob` — enqueue only

[`enqueue/dispatchJob.server.ts`](../../packages/scms-server/src/backend/jobs/enqueue/dispatchJob.server.ts)

```5:13:packages/scms-server/src/backend/jobs/enqueue/dispatchJob.server.ts
export async function dispatchJob(message: JobQueueMessage) {
  return sendJobMessage(message, { idempotencyKey: message.job_id });
}
```

This is the crux: the app **never self-wakes on enqueue** — it depends entirely on the DB trigger (step 5). The chain wake (after draining one message) is the only remaining app-side wake.

### 3c. `notifyQueueConsumer` — the app-side self-HTTP wake

[`enqueue/notifyQueueConsumer.server.ts`](../../packages/scms-server/src/backend/jobs/enqueue/notifyQueueConsumer.server.ts#L54-L81)

- Fire-and-forget POST to push-to-drain with `Authorization: Bearer api.queueConsumerSecret`, wrapped in `waitUntil`.
- Failures are logged at **error** level (with a stable marker) because the only fallback is the once-per-minute `pg_cron` — so a silently-broken wake is a real (just delayed) problem.
- Note the two URL resolvers: [`resolveQueueDrainUrl`](../../packages/scms-server/src/backend/jobs/enqueue/notifyQueueConsumer.server.ts#L4-L7) (app→itself, uses `api.url`) vs [`resolveStoredQueueDrainUrl`](../../packages/scms-server/src/backend/jobs/enqueue/notifyQueueConsumer.server.ts#L21-L29) (the URL stored for `pg_net` to call from **inside** the container — prefers `api.tasksCallbackUrl` / `host.docker.internal`). This distinction matters and is easy to get wrong.

---

## 4. Drain (consume one message)

### 4a. The route

[`platform/scms/app/routes/api/v1.jobs.push-to-drain/route.tsx`](../../platform/scms/app/routes/api/v1.jobs.push-to-drain/route.tsx#L25-L41)

```25:41:platform/scms/app/routes/api/v1.jobs.push-to-drain/route.tsx
export async function action(args: Route.ActionArgs) {
  const appConfig = await getConfig();
  const authHeader = args.request.headers.get('Authorization');
  const expected = `Bearer ${appConfig.api.queueConsumerSecret}`;

  if (!authHeader || authHeader !== expected) {
    return unauthorized();
  }

  waitUntil(
    drainOneJob(consumeJobQueueMessage).catch((error) => {
      console.error('[push-to-drain] drain failed', error);
    }),
  );

  return Response.json({ status: 'accepted' }, { status: 202 });
}
```

- **202 immediately**, work runs in background via `waitUntil`. `maxDuration: 300` matches the pgmq visibility timeout.
- Auth is a **plain string compare** of the Bearer token — review whether constant-time comparison matters here (it's a shared secret, low risk, but worth a note).

### 4b. `drainOneJob` — qty=1 + chain

[`enqueue/drainOneJob.server.ts`](../../packages/scms-server/src/backend/jobs/enqueue/drainOneJob.server.ts)

```13:30:packages/scms-server/src/backend/jobs/enqueue/drainOneJob.server.ts
export async function drainOneJob(consume: DrainJobConsumer): Promise<boolean> {
  const entry = await readOneJobMessage();
  if (!entry) {
    return false;
  }

  await consume(entry.message, entry.metadata);
  await ackJobMessage(entry.msgId);

  const remaining = await getJobQueueDepth();
  if (remaining > 0) {
    notifyQueueConsumer();
  }

  return true;
}
```

- One message per invocation; **chains another wake** (`notifyQueueConsumer`) when depth > 0. This is how a backlog drains.
- `ack` (delete) on success. On a consumer throw the error propagates (the route logs it) and the message is **not** acked — it is redelivered after the 300s visibility timeout, and dead-lettered by `readOneJobMessage` once `read_ct` exceeds the max.

### 4c. Consumer body + rename

- [`platform/scms/app/lib/job-queue-consumer.server.ts`](../../platform/scms/app/lib/job-queue-consumer.server.ts#L10-L16) is now a thin wrapper: register extension jobs → `processJobMessage`.
- Inside `processJobMessage` the log field changed `topicName` → `queueName` ([processJobMessage.server.ts](../../packages/scms-server/src/backend/jobs/run/processJobMessage.server.ts)) — cosmetic but check any log-based alerts/dashboards keyed on `topicName`.

---

## 5. The database-fired wake (most important infra to review)

This is the part with the least "normal code review" coverage and the highest
risk. It is intentionally flattened into one migration so a fresh database reaches
the end state atomically.

### 5a. Queue + config table + wake functions

[`prisma/schema/migrations/20260616190000_add_pgmq_job_queue/migration.sql`](../../prisma/schema/migrations/20260616190000_add_pgmq_job_queue/migration.sql)

- Creates required `pgmq` extension + queue `job` (fails the migration if unavailable).
- Creates [`_JobQueueDrainConfig`](../../prisma/schema/migrations/20260616190000_add_pgmq_job_queue/migration.sql#L16-L21) (single row: `drain_url`, `drain_secret`, both `NOT NULL`).
- Creates required `pg_net` extension and [`public.job_queue_cron_drain()`](../../prisma/schema/migrations/20260616190000_add_pgmq_job_queue/migration.sql#L43-L68) — `SECURITY DEFINER`, reads the config row and `net.http_post`s push-to-drain.
- Creates optional `pg_cron` backup schedule when `pg_cron` is available/creatable.

### 5b. The enqueue trigger

Also in [`20260616190000_add_pgmq_job_queue`](../../prisma/schema/migrations/20260616190000_add_pgmq_job_queue/migration.sql):

```85:107:prisma/schema/migrations/20260616190000_add_pgmq_job_queue/migration.sql
  EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.pgmq_job_enqueue_wake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
BEGIN
  PERFORM public.job_queue_cron_drain();
  RETURN NULL;
END;
$body$;
$fn$;

  DROP TRIGGER IF EXISTS pgmq_job_enqueue_wake_trigger ON pgmq.q_job;
  CREATE TRIGGER pgmq_job_enqueue_wake_trigger
    AFTER INSERT ON pgmq.q_job
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.pgmq_job_enqueue_wake();
```

Things to review hard here:
- **`AFTER INSERT ... FOR EACH STATEMENT`** → one wake per `pgmq.send` call (and one per batch). The `net.http_post` is queued and delivered by the `pg_net` background worker **after commit**.
- Both functions are `SECURITY DEFINER` with `SET search_path = public` — confirm that's the intended privilege posture.
- **Critical operational dependency:** because the app no longer self-wakes on supabase, **`_JobQueueDrainConfig` MUST be populated per environment** or nothing drains promptly (trigger + cron both early-return on empty config). This is called out in the migration comment and the spec.
- Required extensions (`pgmq`, `pg_net`) fail loudly if missing. Only `pg_cron` is optional because it is a backup wake.

---

## 6. Admin UI — the new "Queues" tab

### 6a. Server helpers

[`packages/scms-server/src/backend/jobs/enqueue/jobQueueAdmin.server.ts`](../../packages/scms-server/src/backend/jobs/enqueue/jobQueueAdmin.server.ts#L56-L158)

- [`getJobQueueDrainStatus`](../../packages/scms-server/src/backend/jobs/enqueue/jobQueueAdmin.server.ts#L56-L74) — reports whether the row is configured and whether the stored secret **matches** `api.queueConsumerSecret`. **The secret is never returned** — only length + match boolean. Good.
- [`setJobQueueDrainUrl`](../../packages/scms-server/src/backend/jobs/enqueue/jobQueueAdmin.server.ts#L95-L108) validates the URL (http/https absolute) and upserts; seeds the secret from config when creating the row.
- [`pushJobQueueDrainSecretFromConfig`](../../packages/scms-server/src/backend/jobs/enqueue/jobQueueAdmin.server.ts#L114-L130) pushes the app-config secret into the DB row.
- [`getJobQueueTail`](../../packages/scms-server/src/backend/jobs/enqueue/jobQueueAdmin.server.ts#L143-L158) — peek + depth, with soft error handling when pgmq isn't installed.

### 6b. The route + UI

[`platform/scms/app/routes/app/system.jobs/route.tsx`](../../platform/scms/app/routes/app/system.jobs/route.tsx)

- [`loader`](../../platform/scms/app/routes/app/system.jobs/route.tsx#L48-L93) gathers job types, drain status, queue tail, recent jobs (no provider name — there is only pgmq).
- [`action`](../../platform/scms/app/routes/app/system.jobs/route.tsx#L95-L171) handles intents: `dispatch-loopback`, `drain-now`, `poll-job`, `update-endpoint`, `push-secret`.
- **`drain-now`** ([here](../../platform/scms/app/routes/app/system.jobs/route.tsx#L116-L132)) drains up to `MAX_MANUAL_DRAIN = 10` messages **in-process**, bypassing the HTTP/pg_net wake — the manual recovery path when the wake is misconfigured.
- UI is composed of explicit panels: `QueueInfoPanel`, `DrainConfigPanel`, `QueueTailPanel`, `RecentJobsPanel`, plus the existing `LoopbackTest`. Tab state lives in the `?tab=queues` search param ([here](../../platform/scms/app/routes/app/system.jobs/route.tsx#L756-L774)).

> `QueueInfoPanel` now statically describes the single Supabase pgmq queue (no provider dropdown / `QUEUES_PROVIDER` UI) and the DB-fired wake.

---

## 7. Local-dev infrastructure (real pgmq locally)

### 7a. Custom Postgres image

[`docker/postgres/Dockerfile`](../../docker/postgres/Dockerfile) — `postgres:16` + pgmq + pg_net (built from source) + pg_cron (apt). Crucially it binds the background workers to the `journals` db:

```36:41:docker/postgres/Dockerfile
RUN set -eux; \
    echo "shared_preload_libraries = 'pg_cron,pg_net'" >> /usr/share/postgresql/postgresql.conf.sample; \
    echo "cron.database_name = 'journals'" >> /usr/share/postgresql/postgresql.conf.sample; \
    echo "pg_net.database_name = 'journals'" >> /usr/share/postgresql/postgresql.conf.sample
```

Without this the workers attach to the default `postgres` db and silently never drain the `journals` queue — important gotcha.

### 7b. Compose + init

- [`docker-compose.yml`](../../docker-compose.yml) — builds the image, maps 5432, sets `extra_hosts: host.docker.internal:host-gateway` so `pg_net` (in-container) can reach the dev server on the host.
- [`docker/postgres/init/01-create-databases.sh`](../../docker/postgres/init/01-create-databases.sh) — creates `journals` + `journals_test`; the `journals` role is **SUPERUSER** (local only) so migrations can `CREATE EXTENSION`.
- New npm scripts in [`package.json`](../../package.json#L25-L31): `db:up`, `db:build`, `db:rebuild`, `db:down`, `db:down:clean`, `db:logs`.

### 7c. App-config additions

(see branch diff for `.app-config.schema.yml` / `.app-config.sample.yml`)
- New secret `api.queueConsumerSecret` (Bearer token for push-to-drain).
- New optional `api.tasksCallbackUrl` (e.g. `http://host.docker.internal:3031/v1`) for the in-container `pg_net` wake.
- Removed the never-implemented `dispatchTopic` / `dispatchSASecretKeyfile`.
- No `QUEUES_PROVIDER` env var — pgmq is the only transport, so there is nothing to select.

### 7d. Seeds auto-populate the drain config

[`prisma/seed.utils.mts`](../../prisma/seed.utils.mts#L641-L688) → `seedJobQueueDrainConfig(env)` writes `_JobQueueDrainConfig` from app-config on every `dev:db:reset` / `test:db:reset`, so you don't have to visit the Queues tab after each reset. Called from [`seed.mts`](../../prisma/seed.mts) and [`seed.test.mts`](../../prisma/seed.test.mts).

---

## 8. What was removed / replaced

| Removed | Why |
|---|---|
| `queueProviders/` (whole dir: `types.ts`, `index.server.ts`, `supabase.server.ts`, `mock.server.ts`, `vercel.server.ts`) | The provider abstraction is gone — replaced by the single `pgmq/` module |
| `JobQueueProvider` interface + `wakesOnEnqueue` | No interface and no per-provider wake flag; the app always relies on the DB-fired wake |
| Mock in-memory queue + `QUEUES_PROVIDER` selection | Committed 100% to pgmq; no fallback transport to select |
| `process.env.VERCEL === '1'` check | Lived only in provider selection; removed with it |
| `platform/scms/api/job-queue-consumer.ts` | Vercel Queues push consumer no longer needed |
| `platform/scms/app/routes/api/v1.jobs.mock-push/` | Replaced by `push-to-drain` |
| `@vercel/queue` dependency | swapped to `@vercel/functions` (`waitUntil`) |
| `docs/jobs/dx-local-pubsub.md` + emulator scripts | Pub/Sub emulator path obsolete |

Route registration updated in [`platform/scms/app/routes.ts`](../../platform/scms/app/routes.ts#L287-L293) (`mock-push` → `push-to-drain`).

---

## 9. Tests

- [`tests/jobs/pgmqJobQueue.test.ts`](../../packages/scms-server/tests/jobs/pgmqJobQueue.test.ts) — `sendJobMessage` idempotency: advisory-lock + `WHERE NOT EXISTS`, dedup returns existing id, fallback to idempotencyKey (Prisma mocked).
- [`v1.jobs.push-to-drain/route.test.ts`](../../platform/scms/app/routes/api/v1.jobs.push-to-drain/route.test.ts) — 202 + drains one job when authorized, 401 otherwise.
- Removed with the provider abstraction: `dispatchJob.test.ts`, `queueProviderSelection.test.ts`, `mockQueueProvider.test.ts`, `supabaseQueueProvider.test.ts`.

> Gap to note: there is **no automated test for the SQL migrations / trigger
> behavior** (the DB-fired wake). That path is only exercised manually / in a
> real Supabase or local Docker environment.

---

## Key takeaways — review these thoroughly

1. **The wake is database-fired — always.** `dispatchJob` only enqueues; it never self-wakes. If `_JobQueueDrainConfig` is empty/wrong for an environment, **jobs still enqueue but only drain via the 1-min `pg_cron` backup** (or not at all if cron is also off). This is the single biggest operational risk — verify the post-deploy population step is part of the runbook (`supabase-job-queue-setup.md`).

2. **Two different drain URLs.** `api.url` (app chain-wake self-call) vs `api.tasksCallbackUrl`/`host.docker.internal` (what `pg_net` calls from inside Postgres). `resolveStoredQueueDrainUrl` is used for the DB row + seed; `resolveQueueDrainUrl` for the app chain-wake. Mixing these up = silent local failures.

3. **Idempotency is app-enforced, not native.** pgmq has no dedup; the advisory lock + `WHERE NOT EXISTS` on `pgmq.q_job` is the guard. Confirm the semantics: it only blocks a duplicate **while a message is still queued/in-flight** — a completed job can be re-enqueued. Also confirm `hashtext` collisions are acceptable (different jobs could theoretically share an advisory-lock key; worst case is brief serialization, not incorrectness).

4. **Dead-lettering lives in `readOneJobMessage`.** There is no `nack`. A failing consumer leaves the message leased; it redelivers after the 300s visibility timeout (incrementing `read_ct`). Once `read_ct` exceeds `MAX_JOB_QUEUE_DELIVERY_ATTEMPTS` the read path archives it to `pgmq.a_job` and handles terminal transport failure (`handleTransportFailure`, including default cleanup when appropriate). Confirm the max-attempts value and that `FAILED` is the right terminal state.

5. **Single transport, real pgmq everywhere.** There is no mock/in-memory queue and no `QUEUES_PROVIDER` selection. `npm run dev` requires the Docker Postgres image with pgmq/pg_net/pg_cron (`db:rebuild` is a one-time requirement) — there is no fallback. Confirm the team/README messaging is clear (it is in the changeset).

6. **`SECURITY DEFINER` functions + SUPERUSER local role.** The wake functions run as definer with `search_path=public`; the local `journals` role is SUPERUSER. Fine for local, but double-check the **Supabase** deploy doc grants the minimum needed (pgmq/pg_net usage) rather than assuming superuser.

7. **Auth is a static Bearer compare** in push-to-drain (and the secret flows through app-config → DB row). Low risk for an internal endpoint, but note: no constant-time compare, and the same secret is reused for app-wake, pg_cron, and the trigger.

8. **`maxDuration: 300` ↔ pgmq visibility 300s coupling.** If a handler exceeds 300s, the message becomes visible again and could be **double-processed**. Worth confirming handlers (esp. LOOPBACK is fine, but real CHECK/CONVERTER jobs) can't exceed this, or that double-processing is idempotent downstream.

9. **No migration/trigger tests.** The riskiest new code (PL/pgSQL trigger + cron) has no automated coverage. Consider a smoke test against the Docker image in CI.

10. **Minor doc nits:** `docs/jobs/plan-job-dispatch.md` is marked superseded. Cosmetic only.
