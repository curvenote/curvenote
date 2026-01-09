-- CreateTable
CREATE TABLE "Slug" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "date_modified" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Slug_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Slug_slug_site_id_key" ON "Slug"("slug", "site_id");

-- AddForeignKey
ALTER TABLE "Slug" ADD CONSTRAINT "Slug_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Slug" ADD CONSTRAINT "Slug_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;