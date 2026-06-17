# Job Dispatch — Supabase pgmq Design Spec

**Status:** Implemented  
**Branch:** `mnt/supabase-queues`

## Summary

**Async-only** job architecture: `enqueueAndDispatchJob`, `dispatchJob`, `runHandler`, dependency rows (`BLOCKED` / `depends_on_job_id` / `trigger_on`), and `onJobTerminal`.

**Transport:** [Supabase pgmq](https://github.com/tembo-io/pgmq) queue `job` in Postgres, plus **self-HTTP wake** to `POST /v1/jobs/push-to-drain`. **pg_cron** + `pg_net` provides a once-per-minute backup wake.

No separate queue service. The consumer runs inside SCMS on the same deployment.

## Flow

```
enqueueAndDispatchJob
  → dispatchJob
  → provider.send (mock in-memory | pgmq.send)
  → notifyQueueConsumer (POST /v1/jobs/push-to-drain, Bearer api.queueConsumerSecret)
  → push-to-drain returns 202, waitUntil(drainOneJob)
  → read qty=1, processJobMessage, ack/delete
  → chain wake if queue depth > 0
```

## Providers

| `QUEUES_PROVIDER` | When | Storage |
|---|---|---|
| `mock` | `NODE_ENV=development`, `NODE_ENV=test`, or explicit | In-memory array |
| `supabase` | `VERCEL=1` or explicit | pgmq queue `job` |

Env: `QUEUES_PROVIDER=mock|supabase`. Default **`mock`** in development/test; **`supabase`** when `VERCEL=1`.

## Auth

1. **Wake:** `Authorization: Bearer {api.queueConsumerSecret}` on push-to-drain (app-config secret).
2. **Execute:** Handshake JWT in queue message body (`handshakeSigningSecret` / `handshakeIssuer`).

## Drain contract

- **202 Accepted** immediately — handler runs in background via `waitUntil`.
- **One message per invocation** (`pgmq.read(..., qty=1)`).
- **Chain-if-nonempty** after successful drain.
- Visibility timeout **300s** (matches route `maxDuration`).

## Backup (pg_cron)

Migration creates `_JobQueueDrainConfig` (drain URL + secret) and `job_queue_cron_drain()` scheduled every minute. Populate per environment after deploy — see `platform/scms/README.md`.

## Deploy notes

- Migration: `20260616190000_add_pgmq_job_queue`
- deploy-curvenote: `platform/scms/deploy/deploy-curvenote.md`
- Enable pgmq in Supabase Dashboard if `CREATE EXTENSION` fails

## Key files

| Path | Role |
|---|---|
| `packages/scms-server/.../queueProviders/supabase.server.ts` | pgmq send/read/ack |
| `packages/scms-server/.../queueProviders/mock.server.ts` | Local in-memory queue |
| `packages/scms-server/.../notifyQueueConsumer.server.ts` | Self-HTTP wake |
| `packages/scms-server/.../drainOneJob.server.ts` | qty=1 drain + chain |
| `platform/scms/app/routes/api/v1.jobs.push-to-drain/route.tsx` | 202 + waitUntil consumer |
| `platform/scms/vercel.ts` | `maxDuration` for drain route |

## References

- [pgmq](https://github.com/tembo-io/pgmq)
- [Supabase Queues / pgmq](https://supabase.com/docs/guides/queues)
