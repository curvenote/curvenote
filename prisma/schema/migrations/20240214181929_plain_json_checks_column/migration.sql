/*
  Warnings:

  - The `checks` column on the `SubmissionKind` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "SubmissionKind" DROP COLUMN "checks",
ADD COLUMN "checks" JSONB;
