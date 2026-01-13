-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "ready_for_approval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "data" JSONB;
