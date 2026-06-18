# Job Dispatch — Supabase pgmq Design Spec

**Status:** Implemented  
**Branch:** `mnt/supabase-queues`

## Summary

**Async-only** job architecture: `enqueueAndDispatchJob`, `dispatchJob`, `runHandler`, dependency rows (`BLOCKED` / `depends_on_job_id` / `trigger_on`), and `onJobTerminal`.

**Transport:** [Supabase pgmq](https://github.com/tembo-io/pgmq) queue `job` in Postgres — the single transport everywhere (no provider abstraction / mock queue). The enqueue wake is **database-fired**: a `pg_net` `AFTER INSERT` trigger on `pgmq.q_job` calls `POST /v1/jobs/push-to-drain`. **pg_cron** + `pg_net` provides a once-per-minute backup wake. Local dev runs this same pgmq + `pg_net` stack (the `pg_net`/`pg_cron` workers are bound to the `journals` db).

No separate queue service. The consumer runs inside SCMS on the same deployment.

## Flow

```
enqueueAndDispatchJob
  → dispatchJob → pgmq.send (idempotent on job_id)
  → wake: pg_net trigger on pgmq.q_job → POST /v1/jobs/push-to-drain
    (Bearer api.queueConsumerSecret / "_JobQueueDrainConfig".drain_secret)
  → push-to-drain returns 202, waitUntil(drainOneJob)
  → read qty=1, processJobMessage, ack/delete
      • read_ct > MAX_JOB_QUEUE_DELIVERY_ATTEMPTS → archive (pgmq.a_job) + job FAILED
  → chain wake if queue depth > 0 (app notifyQueueConsumer)
```

## Transport

Single transport: **Supabase pgmq** queue `job`, used in local dev and on every deployment. There is no mock/in-memory queue and no `QUEUES_PROVIDER` selection — local dev requires the pgmq + `pg_net` Docker Postgres image (`docker/postgres/Dockerfile`).

## Auth

1. **Wake:** `Authorization: Bearer {secret}` on push-to-drain — `api.queueConsumerSecret` (app chain wake) or `"_JobQueueDrainConfig".drain_secret` (DB trigger + pg_cron). These must be the same value per environment.
2. **Execute:** Handshake JWT in queue message body (`handshakeSigningSecret` / `handshakeIssuer`).

## Drain contract

- **202 Accepted** immediately — handler runs in background via `waitUntil`.
- **One message per invocation** (`pgmq.read(..., qty=1)`).
- **Chain-if-nonempty** after successful drain.
- Visibility timeout **300s** (matches route `maxDuration`).

## Wake trigger + backup (pg_net / pg_cron)

Migration `20260616190000` creates the pgmq queue, `_JobQueueDrainConfig` (drain URL + secret), `job_queue_cron_drain()` (reads config, `net.http_post` push-to-drain), the optional pg_cron backup schedule, and an `AFTER INSERT` statement-level trigger on `pgmq.q_job` that calls the same `job_queue_cron_drain()`, making enqueue wakes database-fired.

Because the enqueue wake comes only from the database, **`_JobQueueDrainConfig` must be populated** per environment or jobs will not drain promptly (neither the trigger nor pg_cron will wake the consumer). Populate it after deploy — see `platform/scms/deploy/supabase-job-queue-setup.md`.

## Deploy notes

- Migration: `20260616190000_add_pgmq_job_queue`
- Supabase setup: `platform/scms/deploy/supabase-job-queue-setup.md`
- Enable pgmq in Supabase Dashboard if `CREATE EXTENSION` fails

## Key files

| Path                                                           | Role                          |
| -------------------------------------------------------------- | ----------------------------- |
| `packages/scms-server/.../enqueue/pgmq/jobQueue.server.ts`     | pgmq send/read/ack + DLQ      |
| `packages/scms-server/.../notifyQueueConsumer.server.ts`       | Self-HTTP chain wake          |
| `packages/scms-server/.../drainOneJob.server.ts`               | qty=1 drain + chain           |
| `platform/scms/app/routes/api/v1.jobs.push-to-drain/route.tsx` | 202 + waitUntil consumer      |
| `platform/scms/vercel.ts`                                      | `maxDuration` for drain route |

## References

- [pgmq](https://github.com/tembo-io/pgmq)
- [Supabase Queues / pgmq](https://supabase.com/docs/guides/queues)
