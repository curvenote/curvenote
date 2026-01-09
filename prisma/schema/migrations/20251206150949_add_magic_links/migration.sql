-- CreateTable
CREATE TABLE "MagicLink" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "date_modified" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "expiry" TEXT,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "access_limit" INTEGER,

    CONSTRAINT "MagicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MagicLinkAccess" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "magic_link_id" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "success" BOOLEAN NOT NULL,
    "error_message" TEXT,

    CONSTRAINT "MagicLinkAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MagicLink_created_by_id_idx" ON "MagicLink"("created_by_id");

-- CreateIndex
CREATE INDEX "MagicLink_type_idx" ON "MagicLink"("type");

-- CreateIndex
CREATE INDEX "MagicLink_revoked_idx" ON "MagicLink"("revoked");

-- CreateIndex
CREATE INDEX "MagicLinkAccess_magic_link_id_idx" ON "MagicLinkAccess"("magic_link_id");

-- CreateIndex
CREATE INDEX "MagicLinkAccess_date_created_idx" ON "MagicLinkAccess"("date_created");

-- AddForeignKey
ALTER TABLE "MagicLink" ADD CONSTRAINT "MagicLink_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicLinkAccess" ADD CONSTRAINT "MagicLinkAccess_magic_link_id_fkey" FOREIGN KEY ("magic_link_id") REFERENCES "MagicLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
