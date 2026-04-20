-- CreateTable
CREATE TABLE "CspViolationReport" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "effective_directive" TEXT,
    "violated_directive" TEXT,
    "blocked_uri" TEXT,
    "blocked_origin" TEXT,
    "document_origin" TEXT,
    "document_path" TEXT,
    "disposition" TEXT,
    "source_file" TEXT,
    "line_number" INTEGER,
    "column_number" INTEGER,
    "user_agent_sample" TEXT,
    "latest_payload" JSONB NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "date_first_seen" TEXT NOT NULL,
    "date_last_seen" TEXT NOT NULL,

    CONSTRAINT "CspViolationReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CspViolationReport_fingerprint_key" ON "CspViolationReport"("fingerprint");

-- CreateIndex
CREATE INDEX "CspViolationReport_date_last_seen_idx" ON "CspViolationReport"("date_last_seen");

-- CreateIndex
CREATE INDEX "CspViolationReport_effective_directive_idx" ON "CspViolationReport"("effective_directive");

-- CreateIndex
CREATE INDEX "CspViolationReport_disposition_idx" ON "CspViolationReport"("disposition");
