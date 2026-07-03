-- Cron-backed scheduling, scheduled jobs, and CheckServiceRun retry scaffolding.

CREATE TYPE "CronJobTargetType" AS ENUM ('HTTP', 'JOB');
CREATE TYPE "CronJobTargetAuth" AS ENUM ('HANDSHAKE', 'NONE', 'CUSTOM');
CREATE TYPE "CronJobLastStatus" AS ENUM ('SUCCESS', 'FAILED');

CREATE TABLE "CronJob" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "schedule" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "target_type" "CronJobTargetType" NOT NULL,
  "target_url" TEXT,
  "http_method" TEXT DEFAULT 'POST',
  "target_auth" "CronJobTargetAuth" NOT NULL DEFAULT 'HANDSHAKE',
  "target_scope" TEXT,
  "headers" JSONB,
  "payload" JSONB,
  "job_type" TEXT,
  "job_payload" JSONB,
  "last_run_at" TEXT,
  "next_run_at" TEXT,
  "last_status" "CronJobLastStatus",
  "last_error" TEXT,
  "last_run_ms" INTEGER,
  "running_since" TEXT,
  "created_by" TEXT,
  "date_created" TEXT NOT NULL,
  "date_modified" TEXT NOT NULL,
  CONSTRAINT "CronJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CronJob_name_key" ON "CronJob"("name");
CREATE INDEX "CronJob_enabled_next_run_at_idx" ON "CronJob"("enabled", "next_run_at");

CREATE TABLE IF NOT EXISTS "_CronTickConfig" (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tick_url TEXT NOT NULL,
  tick_secret TEXT NOT NULL
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron not creatable in this database (%) — skipping cron-tick schedule', SQLERRM;
    END;
  END IF;

  CREATE EXTENSION IF NOT EXISTS pg_net;

  EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.cron_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  cfg RECORD;
BEGIN
  SELECT tick_url, tick_secret INTO cfg FROM "_CronTickConfig" WHERE id = 1;
  IF NOT FOUND OR cfg.tick_url IS NULL OR cfg.tick_url = '' OR cfg.tick_secret IS NULL OR cfg.tick_secret = '' THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := cfg.tick_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || cfg.tick_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
END;
$body$;
$fn$;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cron-tick') THEN
      PERFORM cron.schedule(
        'cron-tick',
        '* * * * *',
        $cron$SELECT public.cron_tick()$cron$
      );
    END IF;
  END IF;
END;
$$;

ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "scheduled_at" TEXT;

CREATE INDEX IF NOT EXISTS "Job_status_scheduled_at_idx" ON "Job"("status", "scheduled_at");

ALTER TABLE "CheckServiceRun" ADD COLUMN IF NOT EXISTS "status" TEXT;
ALTER TABLE "CheckServiceRun" ADD COLUMN IF NOT EXISTS "attempt" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CheckServiceRun" ADD COLUMN IF NOT EXISTS "retried" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CheckServiceRun" ADD COLUMN IF NOT EXISTS "retried_at" TEXT;
ALTER TABLE "CheckServiceRun" ADD COLUMN IF NOT EXISTS "retry_of_id" TEXT;
ALTER TABLE "CheckServiceRun" ADD COLUMN IF NOT EXISTS "successor_id" TEXT;
ALTER TABLE "CheckServiceRun" ADD COLUMN IF NOT EXISTS "failed_at" TEXT;
ALTER TABLE "CheckServiceRun" ADD COLUMN IF NOT EXISTS "no_auto_retry" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CheckServiceRun" DROP CONSTRAINT IF EXISTS "CheckServiceRun_retry_of_id_fkey";
ALTER TABLE "CheckServiceRun" ADD CONSTRAINT "CheckServiceRun_retry_of_id_fkey"
  FOREIGN KEY ("retry_of_id") REFERENCES "CheckServiceRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CheckServiceRun" DROP CONSTRAINT IF EXISTS "CheckServiceRun_successor_id_fkey";
ALTER TABLE "CheckServiceRun" ADD CONSTRAINT "CheckServiceRun_successor_id_fkey"
  FOREIGN KEY ("successor_id") REFERENCES "CheckServiceRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "CheckServiceRun"
SET
  status = COALESCE(status, data->>'status'),
  retry_of_id = COALESCE(retry_of_id, data->'serviceData'->>'retryOfRunId'),
  retried_at = COALESCE(retried_at, data->'serviceData'->>'retriedAt'),
  successor_id = COALESCE(successor_id, data->'serviceData'->>'supersededByRunId'),
  retried = CASE
    WHEN retried THEN true
    WHEN data->'serviceData'->>'retriedAt' IS NOT NULL THEN true
    WHEN data->'serviceData'->>'supersededByRunId' IS NOT NULL THEN true
    ELSE false
  END
WHERE data IS NOT NULL;

CREATE INDEX "CheckServiceRun_kind_status_retried_no_auto_retry_failed_at_idx"
  ON "CheckServiceRun"("kind", "status", "retried", "no_auto_retry", "failed_at");

ALTER TABLE "Job" DROP COLUMN "follow_on";

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

-- Admin-controlled pause for the pgmq queue drain.
ALTER TABLE "_JobQueueDrainConfig" ADD COLUMN IF NOT EXISTS paused BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.job_queue_cron_drain()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  cfg RECORD;
BEGIN
  SELECT drain_url, drain_secret, paused INTO cfg FROM "_JobQueueDrainConfig" WHERE id = 1;
  IF NOT FOUND OR cfg.paused OR cfg.drain_url IS NULL OR cfg.drain_url = '' THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := cfg.drain_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || cfg.drain_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
END;
$body$;
