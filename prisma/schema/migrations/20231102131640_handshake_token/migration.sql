/*
  Warnings:

  - You are about to drop the column `handshake` on the `Job` table. All the data in the column will be lost.
*/
-- AlterTable
ALTER TABLE "Job" DROP COLUMN "handshake";
ALTER TYPE "SystemRole" ADD VALUE 'SERVICE';
