-- CreateTable
CREATE TABLE "UnsubscribedEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,

    CONSTRAINT "UnsubscribedEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnsubscribedEmail_email_key" ON "UnsubscribedEmail"("email");

-- CreateIndex
CREATE INDEX "UnsubscribedEmail_email_idx" ON "UnsubscribedEmail"("email");
