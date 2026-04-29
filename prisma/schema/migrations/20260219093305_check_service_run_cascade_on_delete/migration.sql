-- DropForeignKey
ALTER TABLE "CheckServiceRun" DROP CONSTRAINT "CheckServiceRun_work_version_id_fkey";

-- AddForeignKey
ALTER TABLE "CheckServiceRun" ADD CONSTRAINT "CheckServiceRun_work_version_id_fkey" FOREIGN KEY ("work_version_id") REFERENCES "WorkVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
