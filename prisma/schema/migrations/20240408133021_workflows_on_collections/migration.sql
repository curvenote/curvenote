-- CreateEnum
CREATE TYPE "EditorialWorkflow" AS ENUM ('SIMPLE', 'PRIVATE', 'OPEN_REVIEW', 'CLOSED_REVIEW');

-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "workflow" "EditorialWorkflow" NOT NULL DEFAULT 'SIMPLE';

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "default_workflow" "EditorialWorkflow" NOT NULL DEFAULT 'SIMPLE';
