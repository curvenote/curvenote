---
'@curvenote/scms-core': minor
'@curvenote/scms-server': minor
'@curvenote/scms-db': minor
'@curvenote/scms': minor
---

Add cron-backed platform automation for scheduled jobs and check retries. This introduces CronJob schema and admin UI, scoped cron callback authentication, scheduled job promotion, cron-driven queue drain, queue pause/resume controls, CheckServiceRun retry columns, and related job-queue hardening for automated execution.
