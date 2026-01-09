/*
  Warnings:

  - Added the required column `date_modified` to the `UserLinkedAccount` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UserLinkedAccount" ADD COLUMN     "date_linked" TEXT,
ADD COLUMN     "date_modified" TEXT,
ADD COLUMN     "pending" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "idAtProvider" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "profile" DROP NOT NULL;
