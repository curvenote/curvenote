/*
  Warnings:

  - A unique constraint covering the columns `[job_id]` on the table `SubmissionVersion` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "SubmissionVersion" ADD COLUMN     "job_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionVersion_job_id_key" ON "SubmissionVersion"("job_id");

-- AddForeignKey
ALTER TABLE "SubmissionVersion" ADD CONSTRAINT "SubmissionVersion_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
