-- AlterTable
ALTER TABLE "public"."Site" ADD COLUMN     "data" JSONB,
ADD COLUMN     "occ" INTEGER NOT NULL DEFAULT 0;
