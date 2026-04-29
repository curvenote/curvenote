-- CreateTable
CREATE TABLE "public"."SystemRoleScope" (
    "role" "public"."SystemRole" NOT NULL,
    "date_created" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "date_modified" TEXT NOT NULL,

    CONSTRAINT "SystemRoleScope_pkey" PRIMARY KEY ("role")
);
