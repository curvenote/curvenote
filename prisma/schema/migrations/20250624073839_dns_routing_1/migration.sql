-- CreateTable
CREATE TABLE "DnsRouter" (
    "id" TEXT NOT NULL,
    "cdn" TEXT NOT NULL,
    "cdn_key" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "is_team" BOOLEAN NOT NULL,
    "owner" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "DnsRouter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DnsRouter_domain_date_created_idx" ON "DnsRouter"("domain", "date_created" DESC);

-- AddForeignKey
ALTER TABLE "DnsRouter" ADD CONSTRAINT "DnsRouter_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
