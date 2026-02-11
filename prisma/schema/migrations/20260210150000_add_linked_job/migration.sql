-- CreateTable
CREATE TABLE "LinkedJob" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "work_version_id" TEXT NOT NULL,

    CONSTRAINT "LinkedJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LinkedJob_work_version_id_idx" ON "LinkedJob"("work_version_id");

-- AddForeignKey
ALTER TABLE "LinkedJob" ADD CONSTRAINT "LinkedJob_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedJob" ADD CONSTRAINT "LinkedJob_work_version_id_fkey" FOREIGN KEY ("work_version_id") REFERENCES "WorkVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
