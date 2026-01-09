-- AlterTable
ALTER TABLE "Job" ALTER COLUMN "job_type" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "date_modified" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "results" JSONB,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_module_type_idx" ON "Message"("module", "type");

-- CreateIndex
CREATE INDEX "Message_date_created_idx" ON "Message"("date_created");
