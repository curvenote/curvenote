-- Rename Access table fields: granted_by_id -> owner_id, user_id -> receiver_id
-- This is a lossless migration that copies data before dropping old columns

-- Step 1: Add new columns (nullable initially)
ALTER TABLE "public"."Access" ADD COLUMN "owner_id" TEXT;
ALTER TABLE "public"."Access" ADD COLUMN "receiver_id" TEXT;

-- Step 2: Copy data from old columns to new columns
UPDATE "public"."Access" SET "owner_id" = "granted_by_id" WHERE "granted_by_id" IS NOT NULL;
UPDATE "public"."Access" SET "receiver_id" = "user_id" WHERE "user_id" IS NOT NULL;

-- Step 3: Make owner_id NOT NULL (since granted_by_id was NOT NULL)
ALTER TABLE "public"."Access" ALTER COLUMN "owner_id" SET NOT NULL;

-- Step 4: Create new indexes
CREATE INDEX "Access_owner_id_idx" ON "public"."Access"("owner_id");
CREATE INDEX "Access_receiver_id_idx" ON "public"."Access"("receiver_id");

-- Step 5: Add foreign key constraints for new columns
ALTER TABLE "public"."Access" ADD CONSTRAINT "Access_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Access" ADD CONSTRAINT "Access_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 6: Drop old foreign key constraints
ALTER TABLE "public"."Access" DROP CONSTRAINT "Access_granted_by_id_fkey";
ALTER TABLE "public"."Access" DROP CONSTRAINT "Access_user_id_fkey";

-- Step 7: Drop old indexes
DROP INDEX "public"."Access_granted_by_id_idx";
DROP INDEX "public"."Access_user_id_idx";

-- Step 8: Drop old columns
ALTER TABLE "public"."Access" DROP COLUMN "granted_by_id";
ALTER TABLE "public"."Access" DROP COLUMN "user_id";

