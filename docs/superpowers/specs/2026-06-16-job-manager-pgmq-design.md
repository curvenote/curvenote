# Job Dispatch — Supabase pgmq Design Spec

**Status:** Implemented  
**Branch:** `mnt/supabase-queues`

## Summary

**Async-only** job architecture: `enqueueAndDispatchJob`, `dispatchJob`, `runHandler`, dependency rows (`BLOCKED` / `depends_on_job_id` / `trigger_on`), and `onJobTerminal`.

**Transport:** [Supabase pgmq](https://github.com/tembo-io/pgmq) queue `job` in Postgres. The enqueue wake is **database-fired**: a `pg_net` `AFTER INSERT` trigger on `pgmq.q_job` calls `POST /v1/jobs/push-to-drain`. **pg_cron** + `pg_net` provides a once-per-minute backup wake. Local dev defaults to this same pgmq + `pg_net` stack (the `pg_net`/`pg_cron` workers are bound to the `journals` db). The mock provider (tests, or `QUEUES_PROVIDER=mock`) self-HTTP wakes from the app since there is no database trigger.

No separate queue service. The consumer runs inside SCMS on the same deployment.

## Flow

```
enqueueAndDispatchJob
  → dispatchJob
  → provider.send (mock in-memory | pgmq.send)
  → wake:
      • supabase: pg_net trigger on pgmq.q_job → POST /v1/jobs/push-to-drain
      • mock:     app notifyQueueConsumer → POST /v1/jobs/push-to-drain
    (Bearer api.queueConsumerSecret / "_JobQueueDrainConfig".drain_secret)
  → push-to-drain returns 202, waitUntil(drainOneJob)
  → read qty=1, processJobMessage, ack/delete
  → chain wake if queue depth > 0 (app notifyQueueConsumer, both providers)
```

## Providers

| `QUEUES_PROVIDER` | When                                       | Storage          |
| ----------------- | ------------------------------------------ | ---------------- |
| `mock`            | `NODE_ENV=test`, or explicit               | In-memory array  |
| `supabase`        | local dev default, `VERCEL=1`, or explicit | pgmq queue `job` |

Env: `QUEUES_PROVIDER=mock|supabase`. Default **`supabase`** in local development (and when `VERCEL=1`); **`mock`** only when `NODE_ENV=test`.

## Auth

1. **Wake:** `Authorization: Bearer {secret}` on push-to-drain — `api.queueConsumerSecret` (app/mock wake) or `"_JobQueueDrainConfig".drain_secret` (DB trigger + pg_cron). These must be the same value per environment.
2. **Execute:** Handshake JWT in queue message body (`handshakeSigningSecret` / `handshakeIssuer`).

## Drain contract

- **202 Accepted** immediately — handler runs in background via `waitUntil`.
- **One message per invocation** (`pgmq.read(..., qty=1)`).
- **Chain-if-nonempty** after successful drain.
- Visibility timeout **300s** (matches route `maxDuration`).

## Wake trigger + backup (pg_net / pg_cron)

Migration `20260616190000` creates `_JobQueueDrainConfig` (drain URL + secret) and `job_queue_cron_drain()` (reads config, `net.http_post` push-to-drain), scheduled every minute. Migration `20260617120000` adds an `AFTER INSERT` statement-level trigger on `pgmq.q_job` that calls the same `job_queue_cron_drain()`, making enqueue wakes database-fired.

Because the supabase enqueue wake now comes only from the database, **`_JobQueueDrainConfig` must be populated** per environment or jobs will not drain promptly (neither the trigger nor pg_cron will wake the consumer). Populate it after deploy — see `platform/scms/deploy/supabase-job-queue-setup.md`.

## Deploy notes

- Migrations: `20260616190000_add_pgmq_job_queue`, `20260617120000_add_pgmq_enqueue_wake_trigger`
- Supabase setup: `platform/scms/deploy/supabase-job-queue-setup.md`
- Enable pgmq in Supabase Dashboard if `CREATE EXTENSION` fails

## Key files

| Path                                                           | Role                          |
| -------------------------------------------------------------- | ----------------------------- |
| `packages/scms-server/.../queueProviders/supabase.server.ts`   | pgmq send/read/ack            |
| `packages/scms-server/.../queueProviders/mock.server.ts`       | Local in-memory queue         |
| `packages/scms-server/.../notifyQueueConsumer.server.ts`       | Self-HTTP wake                |
| `packages/scms-server/.../drainOneJob.server.ts`               | qty=1 drain + chain           |
| `platform/scms/app/routes/api/v1.jobs.push-to-drain/route.tsx` | 202 + waitUntil consumer      |
| `platform/scms/vercel.ts`                                      | `maxDuration` for drain route |

## References

- [pgmq](https://github.com/tembo-io/pgmq)
- [Supabase Queues / pgmq](https://supabase.com/docs/guides/queues)
