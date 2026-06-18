---
'@curvenote/scms-server': patch
'@curvenote/scms': patch
---

Replace the internal job dispatch transport with **Supabase pgmq** as the single queue (no provider abstraction / mock queue): enqueue via `pgmq.send`, drain via `POST /v1/jobs/push-to-drain`. The enqueue wake is fired by Postgres itself — a `pg_net` `AFTER INSERT` trigger on `pgmq.q_job` calls push-to-drain — so the app does not self-call push-to-drain after enqueue; `pg_cron` remains the once-per-minute backup. Because the wake comes from the database, `"_JobQueueDrainConfig"` must be populated for jobs to drain promptly.

Add pgmq **dead-lettering**: when a message's `read_ct` exceeds `MAX_JOB_QUEUE_DELIVERY_ATTEMPTS`, the drain archives it to `pgmq.a_job`, handles the terminal transport failure (including `JOB_FAILED_DEFAULT` cleanup when appropriate), and stops redelivering it, so a poison message can never block the queue.

Add a **Queues** tab to the **System → Jobs** admin page (`/app/system/jobs?tab=queues`) to manage the drain config without raw SQL: save the drain endpoint, push `api.queueConsumerSecret` into `"_JobQueueDrainConfig"`, see whether the stored secret matches app-config, and view a live tail of pending/in-flight pgmq messages. Backed by `peekJobQueue()` and server helpers (`getJobQueueDrainStatus`, `setJobQueueDrainUrl`, `pushJobQueueDrainSecretFromConfig`, `getJobQueueTail`). The tab also gains a **Drain now** button that processes up to 10 messages in-process (bypassing the `pg_net`/HTTP wake) for manual backlog recovery and testing.

The local-dev and test database seeds auto-populate `"_JobQueueDrainConfig"` from app-config (`api.url` + `api.queueConsumerSecret`), so `npm run dev:db:reset` / `npm run test:db:reset` no longer require a manual trip to the Queues tab after each reset. The seed realigns the stored secret with app-config while preserving any custom drain url.

Local development runs the same pgmq + `pg_net` stack as staging/prod. The local Docker Postgres is built from `docker/postgres/Dockerfile` (postgres:16 + pgmq + pg_net + pg_cron), and the dev seed targets `api.tasksCallbackUrl` (`host.docker.internal`) so the `pg_net` enqueue-wake fired inside the container reaches the dev server on the host. The image binds the `pg_net` and `pg_cron` background workers to the `journals` db (`pg_net.database_name` / `cron.database_name`) — without this the workers attach to the default `postgres` db and silently never drain the `journals` queue. **Requires a one-time local rebuild:** `npm run db:rebuild` then `npm run dev:db:reset`.

`send` honors the dispatch `idempotencyKey` (the `job_id`). Because pgmq has no native idempotency, it skips the enqueue when a message for the same job is already pending or in-flight in `pgmq.q_job`, serialized by a transaction-scoped advisory lock keyed on the job id. This prevents a retried enqueue (e.g. a client retry of `POST /v1/jobs` with the same `id`, where `ensureJobRow` already skipped the insert) from adding a second pgmq message and letting two drains run the same job concurrently.
