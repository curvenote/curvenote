-- pgmq job queue for SCMS async job dispatch (Supabase Postgres).
-- Enable pgmq in Supabase Dashboard → Integrations → Queues if CREATE EXTENSION fails.

CREATE EXTENSION IF NOT EXISTS pgmq;

SELECT pgmq.create('job');

-- Per-environment drain wake URL + secret for pg_cron backup (populated after deploy).
CREATE TABLE IF NOT EXISTS "_JobQueueDrainConfig" (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  drain_url TEXT NOT NULL,
  drain_secret TEXT NOT NULL
);

-- pg_cron + pg_net backup wake (safety net if self-HTTP wake is missed).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.job_queue_cron_drain()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'job-queue-drain-backup') THEN
      PERFORM cron.schedule(
        'job-queue-drain-backup',
        '* * * * *',
        $$SELECT public.job_queue_cron_drain()$$
      );
    END IF;
  END IF;
END;
$$;
