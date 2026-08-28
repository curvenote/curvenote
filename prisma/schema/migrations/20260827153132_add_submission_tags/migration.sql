-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'SUBMISSION_TAGS_CHANGE';

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagsInSubmissions" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,

    CONSTRAINT "TagsInSubmissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_site_id_key" ON "Tag"("name", "site_id");

-- CreateIndex
CREATE INDEX "TagsInSubmissions_tag_id_idx" ON "TagsInSubmissions"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "TagsInSubmissions_submission_id_tag_id_key" ON "TagsInSubmissions"("submission_id", "tag_id");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagsInSubmissions" ADD CONSTRAINT "TagsInSubmissions_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagsInSubmissions" ADD CONSTRAINT "TagsInSubmissions_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
