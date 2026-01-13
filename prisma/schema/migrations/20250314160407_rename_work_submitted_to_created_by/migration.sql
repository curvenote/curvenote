-- AlterTable
ALTER TABLE "Work" RENAME COLUMN "submitted_by_id" TO "created_by_id";

-- RenameForeignKey
ALTER TABLE "Work" RENAME CONSTRAINT "Work_submitted_by_id_fkey" TO "Work_created_by_id_fkey";
