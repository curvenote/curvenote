-- CreateEnum
CREATE TYPE "public"."AnalyticsDashboardType" AS ENUM ('PLATFORM', 'SITE');

-- CreateTable
CREATE TABLE "public"."AnalyticsDashboard" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "date_modified" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."AnalyticsDashboardType" NOT NULL,
    "url" TEXT NOT NULL,
    "site_id" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AnalyticsDashboard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsDashboard_type_idx" ON "public"."AnalyticsDashboard"("type");

-- CreateIndex
CREATE INDEX "AnalyticsDashboard_site_id_idx" ON "public"."AnalyticsDashboard"("site_id");

-- CreateIndex
CREATE INDEX "AnalyticsDashboard_enabled_idx" ON "public"."AnalyticsDashboard"("enabled");

-- AddForeignKey
ALTER TABLE "public"."AnalyticsDashboard" ADD CONSTRAINT "AnalyticsDashboard_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
