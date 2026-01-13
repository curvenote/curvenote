-- AlterEnum
ALTER TYPE "SubmissionActivityType" RENAME TO "ActivityType";

-- AlterTable
ALTER TABLE "Activity" RENAME CONSTRAINT "SubmissionActivity_pkey" TO "Activity_pkey";

-- AlterEnum
ALTER TYPE "ActivityType" RENAME VALUE 'VERSION_ADDED' TO 'SUBMISSION_VERSION_ADDED';

-- AlterEnum
ALTER TYPE "ActivityType" RENAME VALUE 'VERSION_STATUS_CHANGE' TO 'SUBMISSION_VERSION_STATUS_CHANGE';