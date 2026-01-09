-- RenameTable
ALTER TABLE "SubmissionActivity" RENAME TO "Activity";

-- RenameForeignKey
ALTER TABLE "Activity" RENAME CONSTRAINT "SubmissionActivity_activity_by_id_fkey" TO "Activity_activity_by_id_fkey";

-- RenameForeignKey
ALTER TABLE "Activity" RENAME CONSTRAINT "SubmissionActivity_kind_id_fkey" TO "Activity_kind_id_fkey";

-- RenameForeignKey
ALTER TABLE "Activity" RENAME CONSTRAINT "SubmissionActivity_submission_id_fkey" TO "Activity_submission_id_fkey";

-- RenameForeignKey
ALTER TABLE "Activity" RENAME CONSTRAINT "SubmissionActivity_submission_version_id_fkey" TO "Activity_submission_version_id_fkey";

-- RenameForeignKey
ALTER TABLE "Activity" RENAME CONSTRAINT "SubmissionActivity_work_id_fkey" TO "Activity_work_id_fkey";

-- RenameForeignKey
ALTER TABLE "Activity" RENAME CONSTRAINT "SubmissionActivity_work_version_id_fkey" TO "Activity_work_version_id_fkey";
