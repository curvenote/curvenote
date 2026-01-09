-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "work_id" TEXT;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
