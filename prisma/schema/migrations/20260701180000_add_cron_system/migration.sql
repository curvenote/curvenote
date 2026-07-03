-- CronJob table + tick config + pg_cron master tick (guarded for test DBs).

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
        '1 minute',
        $cron$SELECT public.cron_tick()$cron$
      );
    END IF;
  END IF;
END;
$$;
