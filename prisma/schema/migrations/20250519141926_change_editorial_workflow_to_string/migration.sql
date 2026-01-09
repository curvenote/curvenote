/*
  Warnings:

  - The `workflow` column on the `Collection` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `default_workflow` column on the `Site` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Collection" ALTER COLUMN "workflow" TYPE text;
ALTER TABLE "Collection" ALTER COLUMN "workflow" SET DEFAULT 'SIMPLE';
ALTER TABLE "Collection" ALTER COLUMN "workflow" SET NOT NULL;

-- AlterTable
ALTER TABLE "Site" ALTER COLUMN "default_workflow" TYPE text;
ALTER TABLE "Site" ALTER COLUMN "default_workflow" SET DEFAULT 'SIMPLE';
ALTER TABLE "Site" ALTER COLUMN "default_workflow" SET NOT NULL;

-- DropEnum
DROP TYPE "EditorialWorkflow" CASCADE;
