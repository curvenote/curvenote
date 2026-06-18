# Code Tour — `mnt/supabase-queues`

> Review guide for the branch that replaces the internal job-dispatch transport
> with **Supabase pgmq** + a database-fired (`pg_net`) drain wake. Read top to
> bottom; each step links to the exact code to review.

**Design spec:** [`docs/superpowers/specs/2026-06-16-job-manager-pgmq-design.md`](../superpowers/specs/2026-06-16-job-manager-pgmq-design.md)
**Changeset:** [`.changeset/pgmq-job-dispatch.md`](../../.changeset/pgmq-job-dispatch.md)

---

## What changed, in one paragraph

The internal job dispatch transport moved from `@vercel/queue` to **Supabase
pgmq** (a Postgres-backed queue). Enqueue is `pgmq.send`; draining happens via
`POST /v1/jobs/push-to-drain` which reads **one** message and runs it in the
background. The big architectural shift is the **wake**: on Supabase, Postgres
itself fires the wake — an `AFTER INSERT` `pg_net` trigger on `pgmq.q_job` calls
push-to-drain, so the app no longer self-calls after enqueue. `pg_cron` is a
once-per-minute backup. A `mock` in-memory provider is used in tests and is
opt-in locally. Local dev now runs the **real** pgmq/pg_net stack via a custom
Docker Postgres image. A new **Queues** admin tab manages the DB-side drain
config (`_JobQueueDrainConfig`) and tails the queue.

---

## 1. The provider contract (start here)

The whole design hangs off one interface. Read this first — every later file
implements or consumes it.

[`packages/scms-server/src/backend/jobs/enqueue/queueProviders/types.ts`](../../packages/scms-server/src/backend/jobs/enqueue/queueProviders/types.ts#L44-L62)

```44:62:packages/scms-server/src/backend/jobs/enqueue/queueProviders/types.ts
export interface JobQueueProvider {
  /**
   * True when the provider guarantees a drain wake on enqueue without the
   * caller self-calling push-to-drain (e.g. a Postgres pg_net trigger on the
   * pgmq queue table). When true, `dispatchJob` skips the app-side wake.
   */
  wakesOnEnqueue?: boolean;
  send(message: JobQueueMessage, options: JobQueueSendOptions): Promise<JobQueueSendResult>;
  readOne(): Promise<QueueReadResult | null>;
  ack(receipt: QueueReadReceipt): Promise<void>;
  /** Leave message for retry (pgmq visibility timeout) or re-queue (mock). */
  nack(receipt: QueueReadReceipt): Promise<void>;
  getDepth(): Promise<number>;
  /**
   * Read-only tail of the queue for admin/monitoring. Returns the most recent
   * messages still in the queue (including in-flight/unacked). Does not consume.
   */
  peek?(limit: number): Promise<QueuePeekEntry[]>;
}
```

Key concepts to keep in mind for the rest of the tour:
- **`wakesOnEnqueue`** — the flag that decides whether the app self-wakes (mock) or relies on the DB trigger (supabase).
- **`receipt`** — an opaque per-provider handle (pgmq `msg_id`, or the mock entry object) returned by `readOne` and passed back to `ack`/`nack`.
- **`peek`** — read-only monitoring, separate from the consume path.

---

## 2. Provider implementations

### 2a. Supabase pgmq provider

[`queueProviders/supabase.server.ts`](../../packages/scms-server/src/backend/jobs/enqueue/queueProviders/supabase.server.ts#L103-L164)

The two things to review carefully here: the `wakesOnEnqueue: true` declaration,
and the **idempotent send** (pgmq has no native idempotency).

```108:149:packages/scms-server/src/backend/jobs/enqueue/queueProviders/supabase.server.ts
  async send(message: JobQueueMessage, options: JobQueueSendOptions): Promise<JobQueueSendResult> {
    const prisma = await getPrismaClient();
    // ... (advisory lock + WHERE NOT EXISTS) ...
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${options.idempotencyKey}))`,
      );
      const rows = await tx.$queryRaw<Array<{ send: bigint }>>(
        Prisma.sql`SELECT pgmq.send(${PGMQ_JOB_QUEUE_NAME}, ${message}::jsonb) AS send
                   WHERE NOT EXISTS (
                     SELECT 1 FROM pgmq.q_job WHERE message ->> 'job_id' = ${options.idempotencyKey}
                   )`,
      );
```

- A **transaction-scoped advisory lock** keyed on `job_id` serializes concurrent sends for the same job, making the check-then-insert atomic.
- Dedup is by scanning `pgmq.q_job` for an existing message with the same `job_id` — review whether that's sufficient (it only dedups messages **still in the queue**; a job already drained + re-enqueued is allowed, which is intended).
- `readOne` uses `pgmq.read(queue, 300, 1)` — visibility timeout `300s`, `qty=1`. See [`PGMQ_VISIBILITY_TIMEOUT_SECONDS`](../../packages/scms-server/src/backend/jobs/enqueue/queueProviders/supabase.server.ts#L15-L16).
- `ack` = `pgmq.delete`; `nack` is a **no-op** (relies on visibility timeout to redeliver). Worth confirming this matches the retry expectations.
- [`peek`](../../packages/scms-server/src/backend/jobs/enqueue/queueProviders/supabase.server.ts#L70-L90) reads `pgmq.q_job` directly so in-flight (leased) messages show up without consuming.

### 2b. Mock in-memory provider

[`queueProviders/mock.server.ts`](../../packages/scms-server/src/backend/jobs/enqueue/queueProviders/mock.server.ts#L45-L149)

```45:48:packages/scms-server/src/backend/jobs/enqueue/queueProviders/mock.server.ts
export const mockQueueProvider: JobQueueProvider = {
  // No database/pg_net locally — the app must self-wake push-to-drain on enqueue.
  wakesOnEnqueue: false,
```

- `wakesOnEnqueue: false` → app self-wakes (the opposite of supabase).
- Single-flight drain via the module-level `drainInProgress` flag — only one in-flight message at a time, which mimics `qty=1` + visibility lease.
- `nack` implements real retry/backoff with `MAX_JOB_QUEUE_DELIVERY_ATTEMPTS` and `terminalizeTransportFailure` — review the [retry/terminalize branch](../../packages/scms-server/src/backend/jobs/enqueue/queueProviders/mock.server.ts#L105-L127).

### 2c. Provider selection

[`queueProviders/index.server.ts`](../../packages/scms-server/src/backend/jobs/enqueue/queueProviders/index.server.ts#L7-L23)

```7:23:packages/scms-server/src/backend/jobs/enqueue/queueProviders/index.server.ts
export function resolveQueueProviderName(): QueueProviderName {
  const explicit = process.env.QUEUES_PROVIDER as QueueProviderName | undefined;
  if (explicit === 'mock' || explicit === 'supabase') {
    return explicit;
  }
  if (process.env.VERCEL === '1') {
    return 'supabase';
  }
  // Tests use the in-process mock queue (no Postgres pgmq/pg_net in CI).
  if (process.env.NODE_ENV === 'test') {
    return 'mock';
  }
  // Local dev now runs the real pgmq + pg_net stack ...
  return 'supabase';
}
```

**Selection precedence:** explicit env → Vercel → test → **default supabase**.
This is a notable behavior change: local dev now defaults to `supabase`, not
`mock`. The provider is cached; tests call `resetJobQueueProviderCache()`.

---

## 3. Enqueue → dispatch → wake

### 3a. `enqueueAndDispatchJob` (entry point, unchanged shape)

[`enqueue/enqueueAndDispatchJob.server.ts`](../../packages/scms-server/src/backend/jobs/enqueue/enqueueAndDispatchJob.server.ts#L20-L115) — inserts the `QUEUED` row (+ any `BLOCKED` dependents) in a transaction, mints the handshake JWT, then calls `dispatchJob`. The queue swap is invisible here.

### 3b. `dispatchJob` — the wake branch

[`enqueue/dispatchJob.server.ts`](../../packages/scms-server/src/backend/jobs/enqueue/dispatchJob.server.ts#L5-L14)

```5:14:packages/scms-server/src/backend/jobs/enqueue/dispatchJob.server.ts
export async function dispatchJob(message: JobQueueMessage) {
  const provider = getJobQueueProvider();
  const result = await provider.send(message, { idempotencyKey: message.job_id });
  // When the provider wakes the consumer on enqueue itself (e.g. supabase's
  // pg_net trigger on pgmq.q_job), skip the redundant app-side self-HTTP wake.
  if (!provider.wakesOnEnqueue) {
    notifyQueueConsumer();
  }
  return result;
}
```

This is the crux: **supabase never self-wakes from the app** — it depends on the DB trigger (step 5).

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

[`enqueue/drainOneJob.server.ts`](../../packages/scms-server/src/backend/jobs/enqueue/drainOneJob.server.ts#L13-L34)

```13:34:packages/scms-server/src/backend/jobs/enqueue/drainOneJob.server.ts
export async function drainOneJob(consume: DrainJobConsumer): Promise<boolean> {
  const provider = getJobQueueProvider();
  const entry = await provider.readOne();
  if (!entry) {
    return false;
  }

  try {
    await consume(entry.message, entry.metadata);
    await provider.ack(entry.receipt);
  } catch (err) {
    await provider.nack(entry.receipt);
    throw err;
  }

  const remaining = await provider.getDepth();
  if (remaining > 0) {
    notifyQueueConsumer();
  }

  return true;
}
```

- One message per invocation; **chains another wake** (`notifyQueueConsumer`) when depth > 0. This is how a backlog drains under both providers.
- ack on success, nack on throw, then re-throw so the route logs it.

### 4c. Consumer body + rename

- [`platform/scms/app/lib/job-queue-consumer.server.ts`](../../platform/scms/app/lib/job-queue-consumer.server.ts#L10-L16) is now a thin wrapper: register extension jobs → `processJobMessage`.
- Inside `processJobMessage` the log field changed `topicName` → `queueName` ([processJobMessage.server.ts](../../packages/scms-server/src/backend/jobs/run/processJobMessage.server.ts)) — cosmetic but check any log-based alerts/dashboards keyed on `topicName`.

---

## 5. The database-fired wake (most important infra to review)

This is the part with the least "normal code review" coverage and the highest
risk. Two migrations.

### 5a. Queue + config table + pg_cron backup

[`prisma/schema/migrations/20260616190000_add_pgmq_job_queue/migration.sql`](../../prisma/schema/migrations/20260616190000_add_pgmq_job_queue/migration.sql)

- Creates `pgmq` extension + queue `job` (guarded — skips if pgmq not available).
- Creates [`_JobQueueDrainConfig`](../../prisma/schema/migrations/20260616190000_add_pgmq_job_queue/migration.sql#L16-L21) (single row: `drain_url`, `drain_secret`, both `NOT NULL`).
- Creates [`public.job_queue_cron_drain()`](../../prisma/schema/migrations/20260616190000_add_pgmq_job_queue/migration.sql#L43-L68) — `SECURITY DEFINER`, reads the config row and `net.http_post`s push-to-drain. Scheduled every minute via `cron.schedule`.

### 5b. The enqueue trigger

[`prisma/schema/migrations/20260617120000_add_pgmq_enqueue_wake_trigger/migration.sql`](../../prisma/schema/migrations/20260617120000_add_pgmq_enqueue_wake_trigger/migration.sql#L37-L60)

```37:60:prisma/schema/migrations/20260617120000_add_pgmq_enqueue_wake_trigger/migration.sql
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
- Everything is guarded so it **skips cleanly** when pgmq/pg_net/pg_cron are absent.

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

- [`loader`](../../platform/scms/app/routes/app/system.jobs/route.tsx#L48-L93) gathers job types, provider name, drain status, queue tail, recent jobs.
- [`action`](../../platform/scms/app/routes/app/system.jobs/route.tsx#L95-L171) handles intents: `dispatch-loopback`, `drain-now`, `poll-job`, `update-endpoint`, `push-secret`.
- **`drain-now`** ([here](../../platform/scms/app/routes/app/system.jobs/route.tsx#L116-L132)) drains up to `MAX_MANUAL_DRAIN = 10` messages **in-process**, bypassing the HTTP/pg_net wake — the manual recovery path when the wake is misconfigured.
- UI is composed of explicit panels: `QueueInfoPanel`, `DrainConfigPanel`, `QueueTailPanel`, `RecentJobsPanel`, plus the existing `LoopbackTest`. Tab state lives in the `?tab=queues` search param ([here](../../platform/scms/app/routes/app/system.jobs/route.tsx#L756-L774)).

> Review note: `QueueInfoPanel`'s supabase copy says "wake POST /v1/jobs/push-to-drain (self-HTTP)" ([line ~373](../../platform/scms/app/routes/app/system.jobs/route.tsx#L369-L374)) — slightly stale wording now that supabase wakes via the **DB trigger**, not self-HTTP. Minor doc nit.

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

### 7d. Seeds auto-populate the drain config

[`prisma/seed.utils.mts`](../../prisma/seed.utils.mts#L641-L688) → `seedJobQueueDrainConfig(env)` writes `_JobQueueDrainConfig` from app-config on every `dev:db:reset` / `test:db:reset`, so you don't have to visit the Queues tab after each reset. Called from [`seed.mts`](../../prisma/seed.mts) and [`seed.test.mts`](../../prisma/seed.test.mts).

---

## 8. What was removed / replaced

| Removed | Why |
|---|---|
| [`queueProviders/vercel.server.ts`](../../packages/scms-server/src/backend/jobs/enqueue/queueProviders/vercel.server.ts) | `@vercel/queue` transport dropped |
| `platform/scms/api/job-queue-consumer.ts` | Vercel Queues push consumer no longer needed |
| `platform/scms/app/routes/api/v1.jobs.mock-push/` | Replaced by `push-to-drain` (both providers share it) |
| `@vercel/queue` dependency | swapped to `@vercel/functions` (`waitUntil`) |
| `docs/jobs/dx-local-pubsub.md` + emulator scripts | Pub/Sub emulator path obsolete |

Route registration updated in [`platform/scms/app/routes.ts`](../../platform/scms/app/routes.ts#L287-L293) (`mock-push` → `push-to-drain`).

---

## 9. Tests

- [`tests/jobs/supabaseQueueProvider.test.ts`](../../packages/scms-server/tests/jobs/supabaseQueueProvider.test.ts) — advisory-lock + `WHERE NOT EXISTS` idempotency, dedup returns existing id, fallback to idempotencyKey.
- [`tests/jobs/dispatchJob.test.ts`](../../packages/scms-server/tests/jobs/dispatchJob.test.ts) — mock provider path wakes push-to-drain with Bearer auth.
- [`tests/jobs/queueProviderSelection.test.ts`](../../packages/scms-server/tests/jobs/queueProviderSelection.test.ts) — the selection matrix (explicit / Vercel / test / dev defaults).
- [`tests/jobs/mockQueueProvider.test.ts`](../../packages/scms-server/tests/jobs/mockQueueProvider.test.ts) — updated for the new mock semantics.
- [`v1.jobs.push-to-drain/route.test.ts`](../../platform/scms/app/routes/api/v1.jobs.push-to-drain/route.test.ts) — 202 + drains one job when authorized, 401 otherwise.

> Gap to note: there is **no automated test for the SQL migrations / trigger
> behavior** (the DB-fired wake). That path is only exercised manually / in a
> real Supabase or local Docker environment.

---

## Key takeaways — review these thoroughly

1. **The wake is now database-fired on supabase.** `dispatchJob` deliberately does **not** self-wake when `wakesOnEnqueue` is true. If `_JobQueueDrainConfig` is empty/wrong for an environment, **jobs still enqueue but only drain via the 1-min `pg_cron` backup** (or not at all if cron is also off). This is the single biggest operational risk — verify the post-deploy population step is part of the runbook (`supabase-job-queue-setup.md`).

2. **Two different drain URLs.** `api.url` (app self-call) vs `api.tasksCallbackUrl`/`host.docker.internal` (what `pg_net` calls from inside Postgres). `resolveStoredQueueDrainUrl` is used for the DB row + seed; `resolveQueueDrainUrl` for app self-wake. Mixing these up = silent local failures.

3. **Idempotency is app-enforced, not native.** pgmq has no dedup; the advisory lock + `WHERE NOT EXISTS` on `pgmq.q_job` is the guard. Confirm the semantics: it only blocks a duplicate **while a message is still queued/in-flight** — a completed job can be re-enqueued. Also confirm `hashtext` collisions are acceptable (different jobs could theoretically share an advisory-lock key; worst case is brief serialization, not incorrectness).

4. **`nack` differs by provider.** Supabase `nack` is a no-op (visibility-timeout redelivery, `read_ct` increments, 300s); mock `nack` does explicit retry/backoff + terminalize after `MAX_JOB_QUEUE_DELIVERY_ATTEMPTS`. Make sure the supabase side actually has a dead-letter / max-attempts story (where do permanently-failing pgmq messages go after repeated 300s redeliveries?).

5. **Local default flipped to `supabase`.** `npm run dev` now needs the Docker Postgres image with pgmq/pg_net (`db:rebuild` is a one-time requirement). Anyone on an old plain-postgres container must set `QUEUES_PROVIDER=mock`. Confirm the team/README messaging is clear (it is in the changeset).

6. **`SECURITY DEFINER` functions + SUPERUSER local role.** The wake functions run as definer with `search_path=public`; the local `journals` role is SUPERUSER. Fine for local, but double-check the **Supabase** deploy doc grants the minimum needed (pgmq/pg_net usage) rather than assuming superuser.

7. **Auth is a static Bearer compare** in push-to-drain (and the secret flows through app-config → DB row). Low risk for an internal endpoint, but note: no constant-time compare, and the same secret is reused for app-wake, pg_cron, and the trigger.

8. **`maxDuration: 300` ↔ pgmq visibility 300s coupling.** If a handler exceeds 300s, the message becomes visible again and could be **double-processed**. Worth confirming handlers (esp. LOOPBACK is fine, but real CHECK/CONVERTER jobs) can't exceed this, or that double-processing is idempotent downstream.

9. **No migration/trigger tests.** The riskiest new code (PL/pgSQL trigger + cron) has no automated coverage. Consider a smoke test against the Docker image in CI.

10. **Minor doc nits:** the Queues-tab supabase copy still says "self-HTTP" for the wake; `docs/jobs/plan-job-dispatch.md` is marked superseded. Cosmetic only.
