-- CreateTable
CREATE TABLE "OAuthAuthorizationState" (
    "state" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'atproto',
    "payload" JSONB NOT NULL,
    "date_created" TEXT NOT NULL,
    "expires_at" TEXT NOT NULL,

    CONSTRAINT "OAuthAuthorizationState_pkey" PRIMARY KEY ("state")
);

-- CreateIndex
CREATE INDEX "OAuthAuthorizationState_expires_at_idx" ON "OAuthAuthorizationState"("expires_at");

-- CreateIndex
CREATE INDEX "OAuthAuthorizationState_provider_expires_at_idx" ON "OAuthAuthorizationState"("provider", "expires_at");

-- AlterTable (nullable FK for pre-verify OAuth session rows)
ALTER TABLE "UserLinkedAccountSession" DROP CONSTRAINT "UserLinkedAccountSession_user_linked_account_id_fkey";

ALTER TABLE "UserLinkedAccountSession" ALTER COLUMN "user_linked_account_id" DROP NOT NULL;

ALTER TABLE "UserLinkedAccountSession" ADD COLUMN "auth_method" JSONB;

ALTER TABLE "UserLinkedAccountSession" ADD CONSTRAINT "UserLinkedAccountSession_user_linked_account_id_fkey" FOREIGN KEY ("user_linked_account_id") REFERENCES "UserLinkedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "UserLinkedAccountSession_sub_active_idx" ON "UserLinkedAccountSession"("sub", "active");
