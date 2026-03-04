-- ActivityType: start-activity types for work timeline (DRAFT_WORK_VERSION_STARTED, CONVERTER_TASK_STARTED, CHECK_STARTED)
ALTER TYPE "ActivityType" ADD VALUE 'DRAFT_WORK_VERSION_STARTED';
ALTER TYPE "ActivityType" ADD VALUE 'CONVERTER_TASK_STARTED';
ALTER TYPE "ActivityType" ADD VALUE 'CHECK_STARTED';

-- Activity.data: general JSON payload (e.g. CHECK_STARTED: { check: { kind } }, CONVERTER_TASK_STARTED: { converter: { target, type } })
ALTER TABLE "Activity" ADD COLUMN "data" JSONB;

-- Job: invoker and activity type for start-activity attribution when jobs are invoked
ALTER TABLE "Job" ADD COLUMN "invoked_by_id" TEXT;
ALTER TABLE "Job" ADD CONSTRAINT "Job_invoked_by_id_fkey" FOREIGN KEY ("invoked_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Job" ADD COLUMN "activity_type" TEXT;
