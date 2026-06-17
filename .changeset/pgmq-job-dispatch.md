---
'@curvenote/scms-server': patch
'@curvenote/scms': patch
---

Replace internal job dispatch transport with Supabase pgmq: enqueue via `pgmq.send`, drain via `POST /v1/jobs/push-to-drain`, mock provider for local dev. On Supabase the enqueue wake is fired by Postgres itself — a `pg_net` `AFTER INSERT` trigger on `pgmq.q_job` calls push-to-drain — so the app no longer self-calls push-to-drain after enqueue (the mock provider still self-wakes locally). pg_cron remains the once-per-minute backup. Because the wake now comes from the database, `"_JobQueueDrainConfig"` must be populated for jobs to drain promptly.

Add a **Queues** tab to the **System → Jobs** admin page (`/app/system/jobs?tab=queues`) to manage the drain config without raw SQL: save the drain endpoint, push `api.queueConsumerSecret` into `"_JobQueueDrainConfig"`, see whether the stored secret matches app-config, and view a live tail of pending/in-flight pgmq messages. Backed by a new queue-provider `peek()` capability and server helpers (`getJobQueueDrainStatus`, `setJobQueueDrainUrl`, `pushJobQueueDrainSecretFromConfig`, `getJobQueueTail`).

The local-dev and test database seeds now auto-populate `"_JobQueueDrainConfig"` from app-config (`api.url` + `api.queueConsumerSecret`), so `npm run dev:db:reset` / `npm run test:db:reset` no longer require a manual trip to the Queues tab after each reset. The seed realigns the stored secret with app-config while preserving any custom drain url.
