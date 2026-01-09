-- CreateTable
CREATE TABLE "UserLinkedAccount" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "idAtProvider" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "profile" JSONB NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "UserLinkedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserLinkedAccount_provider_user_id_key" ON "UserLinkedAccount"("provider", "user_id");

-- AddForeignKey
ALTER TABLE "UserLinkedAccount" ADD CONSTRAINT "UserLinkedAccount_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
