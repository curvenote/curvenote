-- AlterTable

ALTER TABLE "SubmissionVersion" ADD COLUMN     "metadata" JSONB;
ALTER TABLE "SubmissionVersion" ADD COLUMN "occ" INTEGER;
UPDATE "SubmissionVersion" SET "occ" = 0;
ALTER TABLE "SubmissionVersion" ALTER COLUMN "occ" SET NOT NULL;