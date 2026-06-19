-- pgmq job queue for SCMS async job dispatch (Supabase Postgres).
-- pgmq and pg_net are required. The local Docker Postgres image bundles pgmq,
-- pg_net, and pg_cron (docker/postgres/Dockerfile).
-- Enable pgmq in Supabase Dashboard → Integrations → Queues if CREATE EXTENSION fails on Supabase.

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pgmq;

  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'pgmq' AND tablename = 'q_job'
  ) THEN
    PERFORM pgmq.create('job');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'pgmq' AND tablename = 'q_job'
  ) THEN
    RAISE EXCEPTION 'pgmq job queue table pgmq.q_job was not created';
  END IF;
END;
$$;

-- Per-environment drain wake URL + secret for pg_cron backup (populated after deploy).
CREATE TABLE IF NOT EXISTS "_JobQueueDrainConfig" (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  drain_url TEXT NOT NULL,
  drain_secret TEXT NOT NULL
);

-- pg_net-backed wake implementation (required) + pg_cron backup wake (optional).
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;

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
        '30 seconds',
        $cron$SELECT public.job_queue_cron_drain()$cron$
      );
    END IF;
  END IF;

  EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.pgmq_job_enqueue_wake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
BEGIN
  -- Reuse the single wake implementation: reads "_JobQueueDrainConfig" and
  -- net.http_post()s push-to-drain. Statement-level, so one wake per pgmq.send
  -- (and one per batch send). The net.http_post request commits with the enqueue
  -- transaction and is delivered by the pg_net background worker after commit.
  PERFORM public.job_queue_cron_drain();
  RETURN NULL;
END;
$body$;
$fn$;

  DROP TRIGGER IF EXISTS pgmq_job_enqueue_wake_trigger ON pgmq.q_job;
  CREATE TRIGGER pgmq_job_enqueue_wake_trigger
    AFTER INSERT ON pgmq.q_job
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.pgmq_job_enqueue_wake();
END;
$$;
