/*
  Warnings:

  - Added the required column `date_modified` to the `SubmissionKind` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SubmissionKind" ADD COLUMN     "date_modified" TEXT;
