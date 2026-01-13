/*
  Warnings:

  - You are about to drop the column `updated_at` on the `WorkVersion` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "WorkVersion"
ADD COLUMN     "occ" INTEGER NOT NULL DEFAULT 0;
