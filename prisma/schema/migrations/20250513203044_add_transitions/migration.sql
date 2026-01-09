-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "SiteRole" ADD VALUE 'PUBLIC';
ALTER TYPE "SiteRole" ADD VALUE 'UNRESTRICTED';

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'SUBMISSION_VERSION_TRANSITION_STARTED';

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "transition" JSONB;

-- AlterTable
ALTER TABLE "SubmissionVersion" ADD COLUMN     "transition" JSONB;
