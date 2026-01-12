/*
  Warnings:

  - Made the column `date_modified` on table `SubmissionKind` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
UPDATE "SubmissionKind" SET "date_modified" = "date_created";
ALTER TABLE "SubmissionKind" ALTER COLUMN "date_modified" SET NOT NULL;
