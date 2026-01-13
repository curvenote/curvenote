-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_submission_id_fkey";

-- AlterTable
ALTER TABLE "Activity" ALTER COLUMN "submission_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
