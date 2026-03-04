-- AlterTable
ALTER TABLE "Object" ADD COLUMN     "created_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "Object" ADD CONSTRAINT "Object_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
