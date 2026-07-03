-- Seed built-in job-queue-drain CronJob (Phase 2). Does NOT unschedule backup.

INSERT INTO "CronJob" (
  id,
  name,
  description,
  schedule,
  timezone,
  enabled,
  target_type,
  target_url,
  http_method,
  target_auth,
  target_scope,
  payload,
  next_run_at,
  date_created,
  date_modified
)
SELECT
  'builtin-job-queue-drain',
  'job-queue-drain',
  'Wake POST /v1/jobs/push-to-drain every minute via cron tick',
  '* * * * *',
  'UTC',
  true,
  'HTTP'::"CronJobTargetType",
  NULL,
  'POST',
  'HANDSHAKE'::"CronJobTargetAuth",
  'POST:/v1/jobs/push-to-drain',
  '{}'::jsonb,
  to_char((now() AT TIME ZONE 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  to_char((now() AT TIME ZONE 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  to_char((now() AT TIME ZONE 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
WHERE NOT EXISTS (SELECT 1 FROM "CronJob" WHERE name = 'job-queue-drain');

INSERT INTO "CronJob" (
  id,
  name,
  description,
  schedule,
  timezone,
  enabled,
  target_type,
  target_url,
  http_method,
  target_auth,
  target_scope,
  payload,
  next_run_at,
  date_created,
  date_modified
)
SELECT
  'builtin-scheduled-job-sweep',
  'scheduled-job-sweep',
  'Promote due SCHEDULED jobs via POST /v1/jobs/promote-scheduled',
  '* * * * *',
  'UTC',
  true,
  'HTTP'::"CronJobTargetType",
  NULL,
  'POST',
  'HANDSHAKE'::"CronJobTargetAuth",
  'POST:/v1/jobs/promote-scheduled',
  '{}'::jsonb,
  to_char((now() AT TIME ZONE 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  to_char((now() AT TIME ZONE 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  to_char((now() AT TIME ZONE 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
WHERE NOT EXISTS (SELECT 1 FROM "CronJob" WHERE name = 'scheduled-job-sweep');
