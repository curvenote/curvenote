/*
  Warnings:

  - Added the required column `date_modified` to the `SubmissionKind` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "collection_id" TEXT;

-- CreateTable
CREATE TABLE "KindsInCollections" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "date_modified" TEXT NOT NULL,
    "kind_id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,

    CONSTRAINT "KindsInCollections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "date_modified" TEXT NOT NULL,
    "default" BOOLEAN NOT NULL DEFAULT false,
    "open" BOOLEAN NOT NULL DEFAULT true,
    "content" JSONB NOT NULL,
    "site_id" TEXT NOT NULL,
    "parent_id" TEXT,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Collection_name_site_id_key" ON "Collection"("name", "site_id");

-- AddForeignKey
ALTER TABLE "KindsInCollections" ADD CONSTRAINT "KindsInCollections_kind_id_fkey" FOREIGN KEY ("kind_id") REFERENCES "SubmissionKind"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KindsInCollections" ADD CONSTRAINT "KindsInCollections_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
