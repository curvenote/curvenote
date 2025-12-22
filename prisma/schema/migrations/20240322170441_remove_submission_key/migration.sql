/*
  Warnings:

  - You are about to drop the column `key` on the `Submission` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Submission_key_site_id_key";

-- AlterTable
ALTER TABLE "Submission" DROP COLUMN "key";
