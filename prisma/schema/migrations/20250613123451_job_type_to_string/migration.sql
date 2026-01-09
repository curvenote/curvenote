-- AlterTable
ALTER TABLE "Job" ALTER COLUMN "job_type" TYPE text;
ALTER TABLE "Job" ALTER COLUMN "job_type" SET DEFAULT 'CHECK';

-- DropEnum
DROP TYPE "JobType" CASCADE;
