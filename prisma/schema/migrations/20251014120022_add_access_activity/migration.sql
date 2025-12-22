-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ActivityType" ADD VALUE 'ACCESS_GRANTED';
ALTER TYPE "public"."ActivityType" ADD VALUE 'ACCESS_REVOKED';

-- AlterTable
ALTER TABLE "public"."Activity" ADD COLUMN     "access_id" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Activity" ADD CONSTRAINT "Activity_access_id_fkey" FOREIGN KEY ("access_id") REFERENCES "public"."Access"("id") ON DELETE SET NULL ON UPDATE CASCADE;
