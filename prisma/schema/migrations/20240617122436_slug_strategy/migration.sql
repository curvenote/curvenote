-- CreateEnum
CREATE TYPE "SlugStrategy" AS ENUM ('NONE', 'DOI');

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "slug_strategy" "SlugStrategy" NOT NULL DEFAULT 'NONE';
