-- AlterTable
ALTER TABLE "DoiRegistration" ADD COLUMN "content_type" TEXT;

-- Every deposit so far went out as Crossref posted_content, which is Curvenote's PREPRINT.
UPDATE "DoiRegistration" SET "content_type" = 'PREPRINT';

ALTER TABLE "DoiRegistration" ALTER COLUMN "content_type" SET NOT NULL;
