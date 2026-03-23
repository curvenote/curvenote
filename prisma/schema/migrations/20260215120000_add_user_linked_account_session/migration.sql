-- CreateTable
CREATE TABLE "UserLinkedAccountSession" (
    "id" TEXT NOT NULL,
    "user_linked_account_id" TEXT NOT NULL,
    "sub" TEXT NOT NULL,
    "iss" TEXT,
    "token_set" JSONB NOT NULL,
    "dpop_jwk" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "date_created" TEXT NOT NULL,
    "date_modified" TEXT NOT NULL,

    CONSTRAINT "UserLinkedAccountSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserLinkedAccountSession_user_linked_account_id_idx" ON "UserLinkedAccountSession"("user_linked_account_id");

-- CreateIndex
CREATE INDEX "UserLinkedAccountSession_user_linked_account_id_active_idx" ON "UserLinkedAccountSession"("user_linked_account_id", "active");

-- AddForeignKey
ALTER TABLE "UserLinkedAccountSession" ADD CONSTRAINT "UserLinkedAccountSession_user_linked_account_id_fkey" FOREIGN KEY ("user_linked_account_id") REFERENCES "UserLinkedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
