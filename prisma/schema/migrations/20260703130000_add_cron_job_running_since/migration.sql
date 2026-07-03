-- Lease column so tick claims and manual "Run now" claims can't both execute
-- the same CronJob concurrently. Set atomically at claim time, cleared when
-- the run is recorded.

ALTER TABLE "CronJob" ADD COLUMN IF NOT EXISTS "running_since" TEXT;
