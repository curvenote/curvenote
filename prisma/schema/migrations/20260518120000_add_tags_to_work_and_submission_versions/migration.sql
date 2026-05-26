-- AlterTable
ALTER TABLE "WorkVersion" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "SubmissionVersion" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- GIN index for DOI + tag lookups on submission versions
CREATE INDEX "SubmissionVersion_tags_idx" ON "SubmissionVersion" USING GIN ("tags");
