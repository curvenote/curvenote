---
'@curvenote/scms-server': patch
'@curvenote/scms': patch
---

Replace internal job dispatch transport with Supabase pgmq: enqueue via `pgmq.send`, drain via `POST /v1/jobs/push-to-drain` (self-HTTP wake + pg_cron backup), mock provider for local dev.
