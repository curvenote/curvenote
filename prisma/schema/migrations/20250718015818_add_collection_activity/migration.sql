-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'COLLECTION_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'COLLECTION_DELETED';
ALTER TYPE "ActivityType" ADD VALUE 'COLLECTION_CREATED';

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "collection_id" TEXT;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
