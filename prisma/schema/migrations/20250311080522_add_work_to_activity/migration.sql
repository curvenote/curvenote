-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SubmissionActivityType" ADD VALUE 'NEW_WORK';
ALTER TYPE "SubmissionActivityType" ADD VALUE 'WORK_VERSION_ADDED';

-- AlterTable
ALTER TABLE "SubmissionActivity" ADD COLUMN     "work_id" TEXT;

-- AddForeignKey
ALTER TABLE "SubmissionActivity" ADD CONSTRAINT "SubmissionActivity_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
