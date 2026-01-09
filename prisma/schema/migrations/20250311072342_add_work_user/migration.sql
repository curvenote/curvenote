-- CreateEnum
CREATE TYPE "WorkRole" AS ENUM ('OWNER', 'CONTRIBUTOR', 'VIEWER');

-- CreateTable
CREATE TABLE "WorkUser" (
    "id" TEXT NOT NULL,
    "date_created" TEXT NOT NULL,
    "role" "WorkRole" NOT NULL DEFAULT 'VIEWER',
    "work_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "WorkUser_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WorkUser" ADD CONSTRAINT "WorkUser_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "Work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkUser" ADD CONSTRAINT "WorkUser_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
