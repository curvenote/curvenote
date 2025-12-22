-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'CANCELLED';

-- DropIndex
DROP INDEX "idx_submissionversion_metadata_gin";

-- AlterTable
ALTER TABLE "SubmissionVersion" ALTER COLUMN "occ" SET DEFAULT 0;
