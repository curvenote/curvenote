-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "content_id" TEXT;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
