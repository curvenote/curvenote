-- CreateTable
CREATE TABLE "CheckServiceRun" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "date_modified" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" JSONB,
    "occ" INTEGER NOT NULL DEFAULT 0,
    "work_version_id" TEXT NOT NULL,

    CONSTRAINT "CheckServiceRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CheckServiceRun_work_version_id_idx" ON "CheckServiceRun"("work_version_id");

-- CreateIndex
CREATE INDEX "CheckServiceRun_kind_idx" ON "CheckServiceRun"("kind");

-- CreateIndex
CREATE INDEX "CheckServiceRun_date_created_idx" ON "CheckServiceRun"("date_created");

-- AddForeignKey
ALTER TABLE "CheckServiceRun" ADD CONSTRAINT "CheckServiceRun_work_version_id_fkey" FOREIGN KEY ("work_version_id") REFERENCES "WorkVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

