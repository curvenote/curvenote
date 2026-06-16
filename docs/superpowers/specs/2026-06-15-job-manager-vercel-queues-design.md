# Job Dispatch — Vercel Queues Design Spec

**Status:** Approved — **implementation path**  
**Date:** 2026-06-15  
**Implementation plan:** [2026-06-15-job-manager-vercel-queues.md](../plans/2026-06-15-job-manager-vercel-queues.md) — execute on **Go** signal

---

## Summary

**Async-only** job architecture: `enqueueAndDispatchJob`, `dispatchJob`, `runHandler`, dependency rows (`BLOCKED` / `depends_on_job_id` / `trigger_on`), and `onJobTerminal`. **Transport is [Vercel Queues](https://vercel.com/docs/queues)** — topic `job`, consumer `POST /v1/jobs/vercel-push` via `handleCallback`.

**No separate worker service.** The queue consumer runs inside SCMS on Vercel.

---

## Core decisions

| Area | Decision |
|---|---|
| Execution | Async-only; retire `jobs.invoke` |
| Caller API | `enqueueAndDispatchJob` → `{ status: 'DISPATCHED' }` |
| Transport | Vercel Queues topic `job`; local **mock** provider by default |
| Consumer | `POST /v1/jobs/vercel-push` via `handleCallback` |
| Executor | `runHandler` (shared with mock provider via `processJobMessage`) |
| Job table | Domain model; row always created before dispatch |
| Chaining | Separate `BLOCKED` dependent rows + `onJobTerminal` |
| Failure fallback | `JOB_FAILED_DEFAULT` |
| Handlers v2 | No `dbCreateJob`; assume `QUEUED` row exists |
| Authorization | Handshake JWT in queue message — `aud` = job type scope |
| Dead letter | App-level in `handleCallback` `retry` + `handleTransportFailure` (no built-in DLQ topic) |
| Deploy config | `vercel.ts` `experimentalTriggers` (not `vercel.json`) |

---

## Deployment constraint: `vercel.ts` not `vercel.json`

SCMS deploys from a **public submodule** layout where `vercel.json` is not reliably in place until the build starts. Use **[`vercel.ts`](https://vercel.com/docs/project-configuration/vercel-ts)** at the **Vercel project root** (`platform/scms/vercel.ts`) so queue consumer triggers are emitted at build time.

React Router v7 already uses `@vercel/react-router` (`vercelPreset()` in `react-router.config.ts`).

### Queue configuration (single topic, single consumer)

```typescript
// platform/scms/vercel.ts
import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  functions: {
    // Exact key MUST match post-build server function path — verify with `vercel build` output
    'api/v1/jobs/vercel-push/route.js': {
      experimentalTriggers: [
        {
          type: 'queue/v2beta',
          topic: 'job',
          retryAfterSeconds: 60,
          initialDelaySeconds: 0,
        },
      ],
    },
  },
};
```

**Note:** React Router route file is `app/routes/api/v1.jobs.vercel-push/route.tsx` → URL `/v1/jobs/vercel-push`. The `functions` key is the **compiled output path**, not the source path. Task 1 in the implementation plan verifies this mapping.

The consumer route becomes **private** — only Vercel Queues can invoke it ([quickstart](https://vercel.com/docs/queues/quickstart)).

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│  SCMS — enqueueAndDispatchJob()                                           │
│  1. ensureJobRow(parent QUEUED) + BLOCKED dependents                      │
│  2. createHandshakeToken(job_id, job_type)                                │
│  3. dispatchJob → send('job', { job_id, job_type, handshake }, …)       │
│  4. return { job_id, status: 'DISPATCHED' }                               │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Vercel Queues — topic: job                                               │
│  Durable log, at-least-once delivery, automatic retries                   │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ push (experimentalTriggers)
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  SCMS — POST /v1/jobs/vercel-push (queue consumer, private)               │
│  processJobMessage(msg):                                                  │
│    1. verifyHandshakeToken(msg.handshake) → scope + job binding           │
│    2. claims.jobId === msg.job_id && claims.aud === msg.job_type          │
│    3. runHandler(ctx, msg.job_id)                                         │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Postgres — public.Job (domain rows only)                                 │
│  onJobTerminal → promote BLOCKED dependents → dispatchJob                 │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Job API (caller + handler contract)

### `enqueueAndDispatchJob`

Single caller entry point. Creates Job row(s), mints handshake, dispatches parent to queue, returns immediately:

```typescript
await enqueueAndDispatchJob({
  job_type: 'PUBLISH',
  payload: { ... },
  invoked_by_id: userId,
  dependents: [
  {
    job_id: childId,
    job_type: 'PROOFIG_SUBMIT_STREAM',
    payload: { ... },
    trigger_on: 'success',
  },
  ],
});
// → { job_id, status: 'DISPATCHED' }
// Parent is QUEUED + dispatched; dependents are BLOCKED (not in queue).
```

Callers that need completion poll `GET /v1/jobs/:id` or use existing UI patterns — no blocking sync path.

### Handler contract (v2)

Handlers **do not create** Job rows. They receive a `job_id` for an existing `QUEUED` row and:

1. Skip if status is already past `QUEUED` (idempotent re-delivery)
2. Set `RUNNING` → do work (inline steps and/or publish to external worker topics)
3. Return updated row; **`runHandler`** calls **`onJobTerminal(status)`** (dependents, activities, `JOB_FAILED_DEFAULT`)

Handlers **never** call `dbCreateJob`. Rows are created by `enqueueAndDispatchJob` only.

### Migration from legacy patterns

| Legacy | Target |
|---|---|
| `jobs.invoke` | `enqueueAndDispatchJob` |
| `waitUntil(fetch('/v1/jobs'))` | `enqueueAndDispatchJob` |
| `dispatchAJob` | `enqueueAndDispatchJob` |
| `triggerFollowOn` | `onJobTerminal` → `promoteAndDispatchJob` |
| `follow_on` JSON on parent | `dependents[]` at enqueue |

---

## Job dependencies (chaining)

Chaining uses **separate Job rows** linked by foreign key — SCMS owns the graph.

### Schema

```prisma
enum JobStatus {
  BLOCKED    // waiting on depends_on_job_id; not in queue
  QUEUED
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

enum JobTriggerOn {
  SUCCESS
  FAILURE
}

model Job {
  depends_on_job_id  String?
  depends_on         Job?           @relation("JobDependencies", ...)
  dependents         Job[]          @relation("JobDependencies")
  trigger_on         JobTriggerOn?
  follow_on          Json?          // @deprecated — dual-read during migration
}
```

### `onJobTerminal(parent_id, status)`

**When parent → `COMPLETED`:** promote `BLOCKED` + `trigger_on: SUCCESS`; cancel `FAILURE` dependents.

**When parent → `FAILED`:** promote `FAILURE` dependents; cancel `SUCCESS` dependents; if no failure dependents → `enqueueAndDispatchJob(JOB_FAILED_DEFAULT)`.

**`promoteAndDispatchJob`:** assert `BLOCKED` → `QUEUED` → mint handshake → `dispatchJob`.

### `JOB_FAILED_DEFAULT`

Minimal housekeeping when parent `FAILED` with no failure dependents, or transport retries exhausted. Payload includes `failed_job_id`, `reason`, `source`.

---

## dispatchJob (provider abstraction)

`dispatchJob` delegates to a **queue provider**. Production uses Vercel Queues; **local development defaults to an in-process mock** — no OIDC, no network, no second terminal.

```typescript
// packages/scms-server/src/backend/jobs/enqueue/queueProviders/types.ts
export type JobQueueMessage = {
  job_id: string;
  job_type: string;
  handshake: string;
};

export interface JobQueueProvider {
  send(message: JobQueueMessage, options: { idempotencyKey: string }): Promise<{ messageId: string }>;
}

// dispatchJob.server.ts — caller must pass handshake (minted by enqueueAndDispatchJob / promoteAndDispatchJob)
export async function dispatchJob(params: JobQueueMessage) {
  const provider = getJobQueueProvider();
  return provider.send(params, { idempotencyKey: params.job_id });
}
```

### Provider selection

| `QUEUES_PROVIDER` | When | Behaviour |
|---|---|---|
| **`mock`** (default) | `NODE_ENV=development` or unset on local machine | In-process mock queue |
| **`vercel`** | Production, preview, or explicit local opt-in | `@vercel/queue` `send('job', …)` |
| **`pubsub`** | Legacy transition only | Existing Pub/Sub dispatch |

Env: `QUEUES_PROVIDER=mock|vercel|pubsub`. Default **`mock`** in development; **`vercel`** on Vercel (`VERCEL=1`).

### Vercel provider (production)

```typescript
import { send } from '@vercel/queue';

export const vercelQueueProvider: JobQueueProvider = {
  async send(message, { idempotencyKey }) {
    const { messageId } = await send('job', message, { idempotencyKey });
    return { messageId };
  },
};
```

Queue message **`data`** is minimal: `job_id`, `job_type`, `handshake`. Job **payload** stays on the `Job` row only; `runHandler` loads it from DB.

---

## Authentication (handshake JWT — required)

Authorization for job execution uses a **handshake JWT** in the queue message. Queue-private invoke is **not** a substitute — the JWT binds execution to a specific job and **scopes** which handler may run.

### Mint (enqueue time)

`enqueueAndDispatchJob` and `promoteAndDispatchJob` mint before `dispatchJob`:

```typescript
const handshake = createHandshakeToken(
  job_id,
  job_type, // → JWT `aud` — job-type scope
  config.api.handshakeIssuer,
  config.api.handshakeSigningSecret,
  expiry, // recommend 4h — must exceed queue wait + handler + retries
);

await dispatchJob({ job_id, job_type, handshake });
```

Existing helper: `packages/scms-server/src/backend/sign.handshake.server.ts`

| Claim | Purpose |
|---|---|
| `jobId` | Must match `message.job_id` — prevents running a different row |
| `aud` | Must match `message.job_type` — **handler scope**; blocks cross-type invocation |
| `iss` / signature | Proves token was minted by SCMS at dispatch time |
| `exp` | Limits replay window |

### Verify (consume time)

`processJobMessage` verifies **before** `runHandler`:

```typescript
const claims = verifyHandshakeToken(
  message.handshake,
  config.api.handshakeIssuer,
  config.api.handshakeSigningSecret,
);

if (claims.jobId !== message.job_id) throw error401();
if (claims.aud !== message.job_type) throw error401();

// Optional: cross-check Job row
const job = await loadJob(message.job_id);
if (job.job_type !== message.job_type) throw error401();
```

**Invalid or expired handshake:** treat as permanent failure — do not retry (ack / complete). Log and optionally terminalize via `handleTransportFailure` if the row is still `QUEUED`.

**JWT TTL:** **4 hours** default (configurable), or computed from `(retryLimit + 1) × max(backoff) + handler max duration`. Must exceed worst-case queue wait + handler duration + retry backoff.

The handshake travels in the queue **message body**; `handleCallback` passes it to `processJobMessage` (not an HTTP `Authorization` header).

### Mock provider

Mock queue delivers the **full message** including `handshake`. Local dev runs the same verify path as production (no auth bypass).

---

## Local mock queue (default for development)

Local dev **does not** require `vercel env pull`, OIDC tokens, or the real Vercel Queue service by default. Instead, an **in-process mock provider** mirrors production semantics enough for day-to-day work.

### Mock provider behaviour

```typescript
// packages/scms-server/src/backend/jobs/enqueue/queueProviders/mock.server.ts

// Module-level FIFO + dedupe set (idempotencyKey)
// dispatchJob → enqueue → setImmediate/processJobMessage
// processJobMessage → same code path as handleCallback consumer
```

| Concern | Mock behaviour |
|---|---|
| **Delivery** | Async (`queueMicrotask` / `setImmediate`) after `dispatchJob` returns — callers still get `{ status: 'DISPATCHED' }` immediately |
| **Idempotency** | In-memory `Set` of `idempotencyKey` for process lifetime (matches “don't double-dispatch same job_id in one session”) |
| **Consumer** | Calls shared **`processJobMessage(message, metadata)`** — same function `handleCallback` invokes in production |
| **Retries** | On throw: re-enqueue with `deliveryCount + 1`, max 5, optional 1s delay (configurable via `MOCK_QUEUE_RETRY_DELAY_MS`) |
| **Poison / DLQ** | After max attempts → `handleTransportFailure` → ack (no further retry) |
| **Persistence** | None — process restart clears queue (acceptable for local dev) |
| **Logging** | Prefix `[mock-queue]` with `job_id`, `deliveryCount`, `messageId` (uuid) |

### Shared consumer entry point

Extract consumer logic so mock and Vercel use one path:

```typescript
// packages/scms-server/src/backend/jobs/run/processJobMessage.server.ts
export async function processJobMessage(
  message: JobQueueMessage,
  metadata: { deliveryCount: number; messageId: string },
): Promise<void> {
  // 1. verifyHandshakeToken(message.handshake) — jobId + aud (job_type) scope
  // 2. runHandler + retry/DLQ policy (shared with handleCallback wrapper)
}
```

`handleCallback` in `/v1/jobs/vercel-push` becomes a thin wrapper around `processJobMessage` (production/preview only — route may not receive HTTP traffic locally when mock is active).

### Opt-in to real Vercel Queues locally

For integration testing against the real queue service:

```bash
QUEUES_PROVIDER=vercel vercel env pull .env.local
npm run dev
```

Document in `platform/scms/README.md`. CI/preview/production use `QUEUES_PROVIDER=vercel` (or auto-detect `VERCEL=1`).

### Local dev workflow (default)

```bash
# Terminal 1 — SCMS only (no vercel env pull required)
cd platform/scms && npm run dev

# enqueueAndDispatchJob(LOOPBACK) → mock queue → processJobMessage → runHandler
```

**No Pub/Sub emulator. No Vercel OIDC by default.**

---

## Consumer: `/v1/jobs/vercel-push`

Vercel Queues push consumer at `POST /v1/jobs/vercel-push`. Consumer logic lives in **`processJobMessage`** (shared with mock provider):

```typescript
// platform/scms/app/routes/api/v1.jobs.vercel-push/route.tsx
import { handleCallback } from '@vercel/queue';
import { processJobMessage } from '@curvenote/scms-server/.../processJobMessage.server';

export const config = { maxDuration: 300 };

export const action = handleCallback(
  async (message, metadata) => {
    await processJobMessage(message, {
      deliveryCount: metadata.deliveryCount,
      messageId: metadata.messageId,
    });
  },
  {
    visibilityTimeoutSeconds: 300,
    retry: (error, metadata) => {
      if (metadata.deliveryCount > 5) {
        return { acknowledge: true }; // processJobMessage handles handleTransportFailure before ack
      }
      return { afterSeconds: 60 };
    },
  },
);
```

**Idempotency:** `runHandler` skips if job status is not `QUEUED`.

**Auth failures:** invalid/expired handshake or `aud`/`jobId` mismatch → permanent failure (no retry).

**Throws → retry:** transient handler errors throw → Vercel redelivers.

**Permanent failures:** handler marks `FAILED`, returns without throw → message acked.

---

## Dead letter (application-level)

Vercel Queues has **no built-in DLQ topic** ([concepts — dead-letter queue](https://vercel.com/docs/queues/concepts)). When retries are exhausted:

1. `retry` callback returns `{ acknowledge: true }` after `deliveryCount > N`
2. Before ack, invoke **`handleTransportFailure(job_id)`**:
   - Terminalize `QUEUED`/`RUNNING` → `FAILED`
   - `enqueueAndDispatchJob(JOB_FAILED_DEFAULT)`

No separate `/v1/jobs/dead-letter` route required unless we want isolation; logic lives in shared `handleTransportFailure.server.ts` called from `processJobMessage` retry policy (production `handleCallback` and mock provider).

---

## Local development (summary)

| Mode | Setup |
|---|---|
| **Default (mock)** | `npm run dev` — `QUEUES_PROVIDER=mock` automatic in development |
| **Real queues** | `QUEUES_PROVIDER=vercel` + `vercel env pull` ([quickstart](https://vercel.com/docs/queues/quickstart)) |
| **Legacy** | `QUEUES_PROVIDER=pubsub` during Pub/Sub transition |

See **Local mock queue** section above for mock semantics.

---

## Observability

Use [Vercel Queues observability](https://vercel.com/docs/queues/observability):

- Message age, throughput, consumer lag in Vercel dashboard
- Structured logs: `job_id`, `messageId`, `deliveryCount`, `topicName`

---

## Permissions and limits

- Enable **Vercel Queues** on the Vercel team/project ([docs](https://vercel.com/docs/queues) — permissions required)
- `maxDuration: 300` on consumer (matches PUBLISH handler needs)
- Message retention default 24h (configurable on send)
- At-least-once delivery — handlers must stay idempotent

---

## Feature flag

`asyncDispatch.provider`: `pubsub` | `vercel` | `mock`

- **`mock`** — default when `NODE_ENV=development` and not on Vercel
- **`vercel`** — when `VERCEL=1` or explicit override
- **`pubsub`** — legacy transition

Allows staged cutover; local dev never needs real queues unless opted in.

---

---

## References

- [Vercel Queues](https://vercel.com/docs/queues)
- [Queues concepts](https://vercel.com/docs/queues/concepts)
- [Queues SDK](https://vercel.com/docs/queues/sdk)
- [Queues quickstart](https://vercel.com/docs/queues/quickstart)
- [Poll mode](https://vercel.com/docs/queues/poll-mode) (fallback if push + React Router integration is awkward)
