-- AlterTable
ALTER TABLE "CheckServiceRun" ADD COLUMN "created_by_id" TEXT;

-- CreateIndex
CREATE INDEX "CheckServiceRun_created_by_id_idx" ON "CheckServiceRun"("created_by_id");

-- AddForeignKey
ALTER TABLE "CheckServiceRun" ADD CONSTRAINT "CheckServiceRun_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
