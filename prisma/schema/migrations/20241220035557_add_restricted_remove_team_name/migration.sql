/*
  Warnings:

  - You are about to drop the column `team_name` on the `Site` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Site" DROP COLUMN "team_name",
ADD COLUMN     "restricted" BOOLEAN NOT NULL DEFAULT true;
