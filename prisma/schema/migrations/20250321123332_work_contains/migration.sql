-- AlterTable
ALTER TABLE "Work" ADD COLUMN     "contains" TEXT[] DEFAULT ARRAY['myst']::TEXT[];
