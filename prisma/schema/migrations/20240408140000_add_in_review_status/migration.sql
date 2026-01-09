/*
  Warnings:

  - Made the column `collection_id` on table `Submission` required. This step will fail if there are existing NULL values in that column.

*/

-- AlterEnum
ALTER TYPE "SubmissionStatus" ADD VALUE 'IN_REVIEW';
