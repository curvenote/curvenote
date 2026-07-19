-- AlterTable
ALTER TABLE "WorkVersion" ADD COLUMN "contains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
