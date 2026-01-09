/*
  Warnings:

  - A unique constraint covering the columns `[name,site_id]` on the table `SubmissionKind` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "SubmissionKind" ADD COLUMN     "content" JSONB NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionKind_name_site_id_key" ON "SubmissionKind"("name", "site_id");
