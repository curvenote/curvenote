-- Database-fired enqueue wake for the pgmq job queue.
--
-- An AFTER INSERT (statement-level) trigger on pgmq.q_job calls the existing
-- public.job_queue_cron_drain() wake function (net.http_post → push-to-drain),
-- so the primary enqueue wake is fired by Postgres itself. The application no
-- longer self-calls push-to-drain after pgmq.send (see queueProviders.wakesOnEnqueue).
-- pg_cron remains the once-per-minute backup wake.
--
-- Requires the pgmq queue table (pgmq.q_job) and the pg_net-backed wake function
-- created in 20260616190000_add_pgmq_job_queue. On local Docker Postgres (no
-- pgmq / pg_net) this is skipped cleanly — local dev uses QUEUES_PROVIDER=mock.
--
-- NOTE: because the app no longer self-wakes on enqueue when the supabase
-- provider is active, "_JobQueueDrainConfig" must be populated for jobs to drain
-- promptly. An empty config means neither the trigger nor pg_cron will wake the
-- consumer. Populate it per environment (see supabase-job-queue-setup.md Step 4).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'pgmq' AND tablename = 'q_job'
  ) THEN
    RAISE NOTICE 'pgmq.q_job not found — skipping enqueue wake trigger (local dev: use QUEUES_PROVIDER=mock)';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'job_queue_cron_drain'
  ) THEN
    RAISE NOTICE 'public.job_queue_cron_drain() not found (pg_net unavailable) — skipping enqueue wake trigger';
    RETURN;
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
