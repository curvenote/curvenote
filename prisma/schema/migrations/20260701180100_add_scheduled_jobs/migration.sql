-- Scheduled jobs: SCHEDULED status + scheduled_at index.

ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "scheduled_at" TEXT;

CREATE INDEX IF NOT EXISTS "Job_status_scheduled_at_idx" ON "Job"("status", "scheduled_at");
