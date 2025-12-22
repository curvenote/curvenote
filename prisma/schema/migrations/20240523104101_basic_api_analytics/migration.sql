-- CreateTable
CREATE TABLE "ApiEvent" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "headers" JSONB NOT NULL,
    "params" JSONB NOT NULL,
    "site_id" TEXT,
    "user_id" TEXT,
    "ok" BOOLEAN NOT NULL,
    "response_code" INTEGER NOT NULL,
    "response_text" TEXT,
    
    CONSTRAINT "ApiEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ApiEvent" ADD CONSTRAINT "ApiEvent_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiEvent" ADD CONSTRAINT "ApiEvent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
