-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ActivityType" ADD VALUE 'USER_ENABLED';
ALTER TYPE "public"."ActivityType" ADD VALUE 'USER_DISABLED';
ALTER TYPE "public"."ActivityType" ADD VALUE 'USER_APPROVED';
ALTER TYPE "public"."ActivityType" ADD VALUE 'USER_REJECTED';

-- AlterTable
ALTER TABLE "public"."Activity" ADD COLUMN     "user_id" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Activity" ADD CONSTRAINT "Activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
