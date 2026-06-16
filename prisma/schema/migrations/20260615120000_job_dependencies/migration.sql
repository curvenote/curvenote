-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'BLOCKED';

-- CreateEnum
CREATE TYPE "JobTriggerOn" AS ENUM ('SUCCESS', 'FAILURE');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN "depends_on_job_id" TEXT,
ADD COLUMN "trigger_on" "JobTriggerOn";

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_depends_on_job_id_fkey" FOREIGN KEY ("depends_on_job_id") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Job_depends_on_job_id_status_trigger_on_idx" ON "Job"("depends_on_job_id", "status", "trigger_on");
