-- CreateTable
CREATE TABLE "public"."Access" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "date_modified" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "grants" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "work_id" TEXT,
    "user_id" TEXT,
    "site_id" TEXT,
    "granted_by_id" TEXT NOT NULL,

    CONSTRAINT "Access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Access_user_id_idx" ON "public"."Access"("user_id");

-- CreateIndex
CREATE INDEX "Access_granted_by_id_idx" ON "public"."Access"("granted_by_id");

-- CreateIndex
CREATE INDEX "Access_type_idx" ON "public"."Access"("type");

-- CreateIndex
CREATE INDEX "Access_active_idx" ON "public"."Access"("active");

-- AddForeignKey
ALTER TABLE "public"."Access" ADD CONSTRAINT "Access_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Access" ADD CONSTRAINT "Access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Access" ADD CONSTRAINT "Access_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Access" ADD CONSTRAINT "Access_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
