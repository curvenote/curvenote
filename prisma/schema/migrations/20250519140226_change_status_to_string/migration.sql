/*
  Warnings:

  - The `status` column on the `Activity` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `SubmissionVersion` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Activity" ALTER COLUMN "status" TYPE text;
ALTER TABLE "Activity" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "SubmissionVersion" ALTER COLUMN "status" TYPE text;
ALTER TABLE "SubmissionVersion" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "SubmissionVersion" ALTER COLUMN "status" SET NOT NULL;

-- DropEnum
DROP TYPE "SubmissionStatus" CASCADE;
