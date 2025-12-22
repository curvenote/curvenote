-- CreateTable
CREATE TABLE "Object" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "date_modified" TEXT NOT NULL,
    "data" JSONB,
    "occ" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Object_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Object_type_idx" ON "Object"("type");
