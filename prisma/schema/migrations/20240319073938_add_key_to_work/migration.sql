/*
  Warnings:

  - A unique constraint covering the columns `[key]` on the table `Work` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Work" ADD COLUMN     "key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Work_key_key" ON "Work"("key");
