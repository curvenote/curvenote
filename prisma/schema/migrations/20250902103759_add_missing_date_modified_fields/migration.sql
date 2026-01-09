-- AddColumn
ALTER TABLE "UserToken" ADD COLUMN "date_modified" TEXT;
ALTER TABLE "Activity" ADD COLUMN "date_modified" TEXT;
ALTER TABLE "ApiEvent" ADD COLUMN "date_modified" TEXT;
ALTER TABLE "WorkUser" ADD COLUMN "date_modified" TEXT;
ALTER TABLE "Work" ADD COLUMN "date_modified" TEXT;
ALTER TABLE "WorkVersion" ADD COLUMN "date_modified" TEXT;
ALTER TABLE "User" ADD COLUMN "date_modified" TEXT;
ALTER TABLE "SubmissionVersion" ADD COLUMN "date_modified" TEXT;
ALTER TABLE "Submission" ADD COLUMN "date_modified" TEXT;
ALTER TABLE "SiteUser" ADD COLUMN "date_modified" TEXT;
ALTER TABLE "Site" ADD COLUMN "date_modified" TEXT;
ALTER TABLE "Domain" ADD COLUMN "date_modified" TEXT;
ALTER TABLE "DnsRouter" ADD COLUMN "date_modified" TEXT;

-- Backfill date_modified from date_created
UPDATE "UserToken" SET "date_modified" = "date_created";
UPDATE "Activity" SET "date_modified" = "date_created";
UPDATE "ApiEvent" SET "date_modified" = "date_created";
UPDATE "WorkUser" SET "date_modified" = "date_created";
UPDATE "Work" SET "date_modified" = "date_created";
UPDATE "WorkVersion" SET "date_modified" = "date_created";
UPDATE "User" SET "date_modified" = "date_created";
UPDATE "SubmissionVersion" SET "date_modified" = "date_created";
UPDATE "Submission" SET "date_modified" = "date_created";
UPDATE "SiteUser" SET "date_modified" = "date_created";
UPDATE "Site" SET "date_modified" = "date_created";
UPDATE "Domain" SET "date_modified" = "date_created";
UPDATE "DnsRouter" SET "date_modified" = "date_created";

-- Make date_modified columns NOT NULL after backfilling
ALTER TABLE "UserToken" ALTER COLUMN "date_modified" SET NOT NULL;
ALTER TABLE "Activity" ALTER COLUMN "date_modified" SET NOT NULL;  
ALTER TABLE "ApiEvent" ALTER COLUMN "date_modified" SET NOT NULL;
ALTER TABLE "WorkUser" ALTER COLUMN "date_modified" SET NOT NULL;
ALTER TABLE "Work" ALTER COLUMN "date_modified" SET NOT NULL;
ALTER TABLE "WorkVersion" ALTER COLUMN "date_modified" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "date_modified" SET NOT NULL;
ALTER TABLE "SubmissionVersion" ALTER COLUMN "date_modified" SET NOT NULL;
ALTER TABLE "Submission" ALTER COLUMN "date_modified" SET NOT NULL;
ALTER TABLE "SiteUser" ALTER COLUMN "date_modified" SET NOT NULL;
ALTER TABLE "Site" ALTER COLUMN "date_modified" SET NOT NULL;
ALTER TABLE "Domain" ALTER COLUMN "date_modified" SET NOT NULL;
ALTER TABLE "DnsRouter" ALTER COLUMN "date_modified" SET NOT NULL;