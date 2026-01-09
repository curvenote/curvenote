-- AlterTable
ALTER TABLE "Site" ADD COLUMN "team_name" TEXT;
UPDATE "Site" SET team_name = 'tellus' WHERE "name" = 'tellus';