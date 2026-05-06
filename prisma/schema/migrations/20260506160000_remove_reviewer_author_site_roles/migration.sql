-- Remap removed site roles to SUBMITTER before replacing the enum.
UPDATE "SiteUser"
SET "role" = 'SUBMITTER'::"SiteRole"
WHERE "role"::text IN ('REVIEWER', 'AUTHOR');

CREATE TYPE "SiteRole_new" AS ENUM (
  'ADMIN',
  'SUBMITTER',
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

ALTER TABLE "SiteUser" ALTER COLUMN "role" SET DEFAULT 'SUBMITTER'::"SiteRole";
