-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'SITE_CONTENT_UPDATED';

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "site_id" TEXT;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
