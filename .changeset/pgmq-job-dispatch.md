---
'@curvenote/scms-server': patch
'@curvenote/scms': patch
---

Replace internal job dispatch transport with Supabase pgmq: enqueue via `pgmq.send`, drain via `POST /v1/jobs/push-to-drain`, mock provider for local dev. On Supabase the enqueue wake is fired by Postgres itself — a `pg_net` `AFTER INSERT` trigger on `pgmq.q_job` calls push-to-drain — so the app no longer self-calls push-to-drain after enqueue (the mock provider still self-wakes locally). pg_cron remains the once-per-minute backup. Because the wake now comes from the database, `"_JobQueueDrainConfig"` must be populated for jobs to drain promptly.

Add a **Queues** tab to the **System → Jobs** admin page (`/app/system/jobs?tab=queues`) to manage the drain config without raw SQL: save the drain endpoint, push `api.queueConsumerSecret` into `"_JobQueueDrainConfig"`, see whether the stored secret matches app-config, and view a live tail of pending/in-flight pgmq messages. Backed by a new queue-provider `peek()` capability and server helpers (`getJobQueueDrainStatus`, `setJobQueueDrainUrl`, `pushJobQueueDrainSecretFromConfig`, `getJobQueueTail`).

The local-dev and test database seeds now auto-populate `"_JobQueueDrainConfig"` from app-config (`api.url` + `api.queueConsumerSecret`), so `npm run dev:db:reset` / `npm run test:db:reset` no longer require a manual trip to the Queues tab after each reset. The seed realigns the stored secret with app-config while preserving any custom drain url.

Local development now defaults to the **supabase** provider (real pgmq + pg_net) instead of the in-memory mock queue, for parity with staging/prod. The local Docker Postgres is now built from `docker/postgres/Dockerfile` (postgres:16 + pgmq + pg_net + pg_cron), and the dev seed targets `api.tasksCallbackUrl` (`host.docker.internal`) so the `pg_net` enqueue-wake fired inside the container reaches the dev server on the host. Set `QUEUES_PROVIDER=mock` to opt back into the in-memory queue. **Requires a one-time local rebuild:** `npm run db:rebuild` then `npm run dev:db:reset`.

The local Postgres image also binds the `pg_net` and `pg_cron` background workers to the `journals` db (`pg_net.database_name` / `cron.database_name`) — without this the workers attach to the default `postgres` db and silently never drain the `journals` queue. The Queues tab additionally gains a **Drain now** button that processes up to 10 messages in-process (bypassing the `pg_net`/HTTP wake) for manual backlog recovery and testing.
