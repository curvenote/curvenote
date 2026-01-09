-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ActivityType" ADD VALUE 'ROLE_CREATED';
ALTER TYPE "public"."ActivityType" ADD VALUE 'ROLE_UPDATED';
ALTER TYPE "public"."ActivityType" ADD VALUE 'ROLE_DELETED';
ALTER TYPE "public"."ActivityType" ADD VALUE 'ROLE_ASSIGNED';
ALTER TYPE "public"."ActivityType" ADD VALUE 'ROLE_REMOVED';

-- AlterTable
ALTER TABLE "public"."Activity" ADD COLUMN     "role_id" TEXT,
ADD COLUMN     "user_role_id" TEXT;

-- CreateTable
CREATE TABLE "public"."Role" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "date_modified" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserRole" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "date_modified" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "public"."Role"("name");

-- CreateIndex
CREATE INDEX "Role_name_idx" ON "public"."Role"("name");

-- CreateIndex
CREATE INDEX "UserRole_user_id_idx" ON "public"."UserRole"("user_id");

-- CreateIndex
CREATE INDEX "UserRole_role_id_idx" ON "public"."UserRole"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_user_id_role_id_key" ON "public"."UserRole"("user_id", "role_id");

-- AddForeignKey
ALTER TABLE "public"."Activity" ADD CONSTRAINT "Activity_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Activity" ADD CONSTRAINT "Activity_user_role_id_fkey" FOREIGN KEY ("user_role_id") REFERENCES "public"."UserRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Role" ADD CONSTRAINT "Role_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
