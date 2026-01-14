-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'FORM_DELETED';
ALTER TYPE "ActivityType" ADD VALUE 'FORM_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'FORM_UPDATED';

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "form_id" TEXT;

-- CreateTable
CREATE TABLE "CollectionsInForms" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "date_modified" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,

    CONSTRAINT "CollectionsInForms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionForm" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "date_modified" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "site_id" TEXT NOT NULL,
    "kind_id" TEXT NOT NULL,

    CONSTRAINT "SubmissionForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionForm_name_site_id_key" ON "SubmissionForm"("name", "site_id");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "SubmissionForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionsInForms" ADD CONSTRAINT "CollectionsInForms_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionsInForms" ADD CONSTRAINT "CollectionsInForms_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "SubmissionForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionForm" ADD CONSTRAINT "SubmissionForm_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionForm" ADD CONSTRAINT "SubmissionForm_kind_id_fkey" FOREIGN KEY ("kind_id") REFERENCES "SubmissionKind"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
