DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "SiteUser" WHERE "role" = 'EDITOR') THEN
    RAISE EXCEPTION 'Cannot remove SiteRole.EDITOR: existing SiteUser rows still use it';
  END IF;
END $$;

CREATE TYPE "SiteRole_new" AS ENUM (
  'ADMIN',
  'SUBMITTER',
  'REVIEWER',
  'AUTHOR',
  'PUBLIC',
  'UNRESTRICTED'
);

ALTER TABLE "SiteUser" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "SiteUser"
ALTER COLUMN "role" TYPE "SiteRole_new"
USING ("role"::text::"SiteRole_new");

ALTER TYPE "SiteRole" RENAME TO "SiteRole_old";
ALTER TYPE "SiteRole_new" RENAME TO "SiteRole";
DROP TYPE "SiteRole_old";

ALTER TABLE "SiteUser" ALTER COLUMN "role" SET DEFAULT 'AUTHOR'::"SiteRole";
