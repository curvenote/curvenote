---
'@curvenote/scms-server': patch
'@curvenote/scms': patch
---

Replace internal job dispatch transport with Supabase pgmq: enqueue via `pgmq.send`, drain via `POST /v1/jobs/push-to-drain`, mock provider for local dev. On Supabase the enqueue wake is fired by Postgres itself — a `pg_net` `AFTER INSERT` trigger on `pgmq.q_job` calls push-to-drain — so the app no longer self-calls push-to-drain after enqueue (the mock provider still self-wakes locally). pg_cron remains the once-per-minute backup. Because the wake now comes from the database, `"_JobQueueDrainConfig"` must be populated for jobs to drain promptly.

Add a **System → Queues** admin route (`/app/system/queues`) to manage the drain config without raw SQL: save the drain endpoint, push `api.queueConsumerSecret` into `"_JobQueueDrainConfig"`, see whether the stored secret matches app-config, and view a live tail of pending/in-flight pgmq messages. Backed by a new queue-provider `peek()` capability and server helpers (`getJobQueueDrainStatus`, `setJobQueueDrainUrl`, `pushJobQueueDrainSecretFromConfig`, `getJobQueueTail`).
