-- pgmq job queue for SCMS async job dispatch (Supabase Postgres).
-- On local Docker Postgres, pgmq is not installed; skip when unavailable (use QUEUES_PROVIDER=mock).
-- Enable pgmq in Supabase Dashboard → Integrations → Queues if CREATE EXTENSION fails on Supabase.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pgmq') THEN
    CREATE EXTENSION IF NOT EXISTS pgmq;
    PERFORM pgmq.create('job');
  ELSE
    RAISE NOTICE 'pgmq extension not available — skipping job queue setup (local dev: use QUEUES_PROVIDER=mock)';
  END IF;
END;
$$;

-- Per-environment drain wake URL + secret for pg_cron backup (populated after deploy).
CREATE TABLE IF NOT EXISTS "_JobQueueDrainConfig" (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  drain_url TEXT NOT NULL,
  drain_secret TEXT NOT NULL
);

-- pg_cron + pg_net backup wake (Supabase only; skipped on standard Docker/local Postgres).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    RAISE NOTICE 'pg_net not available — skipping cron drain backup setup';
    RETURN;
  END IF;

  -- pg_cron is bound to a single database (cron.database_name). CREATE EXTENSION
  -- raises in any other DB (e.g. journals_test locally), so swallow that error —
  -- the pg_net enqueue-wake trigger is the primary wake; pg_cron is only a backup.
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron not creatable in this database (%) — skipping cron backup wake', SQLERRM;
    END;
  END IF;
  CREATE EXTENSION IF NOT EXISTS pg_net;

  EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.job_queue_cron_drain()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  cfg RECORD;
BEGIN
  SELECT drain_url, drain_secret INTO cfg FROM "_JobQueueDrainConfig" WHERE id = 1;
  IF NOT FOUND OR cfg.drain_url IS NULL OR cfg.drain_url = '' THEN
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
$fn$;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'job-queue-drain-backup') THEN
      PERFORM cron.schedule(
        'job-queue-drain-backup',
        '* * * * *',
        $cron$SELECT public.job_queue_cron_drain()$cron$
      );
    END IF;
  END IF;
END;
$$;
