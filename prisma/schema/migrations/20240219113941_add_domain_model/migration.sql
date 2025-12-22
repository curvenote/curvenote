/*
  Warnings:

  - You are about to drop the column `hostname` on the `Site` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Site" DROP COLUMN "hostname";

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Domain_hostname_key" ON "Domain"("hostname");

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
