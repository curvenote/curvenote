-- Opt-out flag for platform auto-retry sweeps (per CheckServiceRun; manual retry unaffected).

ALTER TABLE "CheckServiceRun" ADD COLUMN IF NOT EXISTS "no_auto_retry" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS "CheckServiceRun_kind_status_retried_failed_at_idx";
CREATE INDEX "CheckServiceRun_kind_status_retried_no_auto_retry_failed_at_idx"
  ON "CheckServiceRun"("kind", "status", "retried", "no_auto_retry", "failed_at");
