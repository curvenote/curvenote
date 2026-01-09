/*
  Warnings:

  - A unique constraint covering the columns `[key,site_id]` on the table `Submission` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Submission_key_site_id_key" ON "Submission"("key", "site_id");
