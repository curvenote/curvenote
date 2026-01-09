-- AlterEnum
ALTER TYPE "SubmissionActivityType" ADD VALUE 'SUBMISSION_DATE_CHANGE';

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "date_published" TEXT;

-- AlterTable
ALTER TABLE "SubmissionActivity" ADD COLUMN     "date_published" TEXT;

-- AlterTable
ALTER TABLE "SubmissionVersion" ADD COLUMN     "date_published" TEXT;
