-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'DOI_REGISTRATION_STARTED';
ALTER TYPE "ActivityType" ADD VALUE 'DOI_REGISTRATION_COMPLETED';
ALTER TYPE "ActivityType" ADD VALUE 'DOI_REGISTRATION_FAILED';

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "doi" TEXT;

-- AlterTable
ALTER TABLE "SiteDoiConfig" DROP COLUMN "attention_reason";

-- CreateTable
CREATE TABLE "DoiRegistration" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "date_modified" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "doi" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "registered_at" TEXT,
    "created_by_id" TEXT,
    "occ" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DoiRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoiDeposit" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "date_modified" TEXT NOT NULL,
    "registration_id" TEXT NOT NULL,
    "submission_version_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "doi_batch_id" TEXT NOT NULL,
    "crossref_submission_id" TEXT,
    "xml_path" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result_xml_path" TEXT,
    "error" TEXT,
    "warning" TEXT,
    "job_id" TEXT,
    "completed_at" TEXT,

    CONSTRAINT "DoiDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DoiRegistration_submission_id_key" ON "DoiRegistration"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "DoiRegistration_doi_key" ON "DoiRegistration"("doi");

-- CreateIndex
CREATE INDEX "DoiRegistration_site_id_idx" ON "DoiRegistration"("site_id");

-- CreateIndex
CREATE UNIQUE INDEX "DoiDeposit_file_name_key" ON "DoiDeposit"("file_name");

-- CreateIndex
CREATE UNIQUE INDEX "DoiDeposit_doi_batch_id_key" ON "DoiDeposit"("doi_batch_id");

-- CreateIndex
CREATE INDEX "DoiDeposit_registration_id_date_created_idx" ON "DoiDeposit"("registration_id", "date_created" DESC);

-- CreateIndex
CREATE INDEX "DoiDeposit_submission_version_id_idx" ON "DoiDeposit"("submission_version_id");

-- AddForeignKey
ALTER TABLE "DoiRegistration" ADD CONSTRAINT "DoiRegistration_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoiRegistration" ADD CONSTRAINT "DoiRegistration_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoiRegistration" ADD CONSTRAINT "DoiRegistration_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoiDeposit" ADD CONSTRAINT "DoiDeposit_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "DoiRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoiDeposit" ADD CONSTRAINT "DoiDeposit_submission_version_id_fkey" FOREIGN KEY ("submission_version_id") REFERENCES "SubmissionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
