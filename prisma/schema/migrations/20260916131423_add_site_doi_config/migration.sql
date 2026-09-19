-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'SITE_DOI_CONFIG_UPDATED';

-- CreateTable
CREATE TABLE "SiteDoiConfig" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "date_modified" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "prefix_owner" TEXT,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_ROLE',
    "attention_reason" TEXT,
    "occ" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SiteDoiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteDoiConfig_site_id_key" ON "SiteDoiConfig"("site_id");

-- Partial unique index, raw SQL only (Prisma cannot express it; documented on the model).
-- On CUSTOM_PREFIX sites a prefix/role pair belongs to one site. CURVENOTE_PREFIX sites all share Curvenote's
-- prefix and role, so they are excluded. NULL roles never collide, so several CUSTOM_PREFIX
-- sites may wait on the same prefix before a role is bound.
CREATE UNIQUE INDEX "SiteDoiConfig_custom_prefix_role_key"
  ON "SiteDoiConfig"("prefix", "role")
  WHERE "mode" = 'CUSTOM_PREFIX';

-- AddForeignKey
ALTER TABLE "SiteDoiConfig" ADD CONSTRAINT "SiteDoiConfig_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
