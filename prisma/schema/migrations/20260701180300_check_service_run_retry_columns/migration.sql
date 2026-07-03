-- CheckServiceRun first-class retry/status columns + agnostic backfill.

ALTER TABLE "CheckServiceRun" ADD COLUMN IF NOT EXISTS "status" TEXT;
ALTER TABLE "CheckServiceRun" ADD COLUMN IF NOT EXISTS "attempt" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CheckServiceRun" ADD COLUMN IF NOT EXISTS "retried" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CheckServiceRun" ADD COLUMN IF NOT EXISTS "retried_at" TEXT;
ALTER TABLE "CheckServiceRun" ADD COLUMN IF NOT EXISTS "retry_of_id" TEXT;
ALTER TABLE "CheckServiceRun" ADD COLUMN IF NOT EXISTS "successor_id" TEXT;
ALTER TABLE "CheckServiceRun" ADD COLUMN IF NOT EXISTS "failed_at" TEXT;

CREATE INDEX IF NOT EXISTS "CheckServiceRun_kind_status_retried_failed_at_idx"
  ON "CheckServiceRun"("kind", "status", "retried", "failed_at");

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
