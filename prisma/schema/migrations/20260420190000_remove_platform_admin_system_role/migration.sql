DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "public"."User" WHERE "system_role"::text = 'PLATFORM_ADMIN') THEN
    RAISE EXCEPTION 'Cannot remove PLATFORM_ADMIN from SystemRole: User rows still reference it';
  END IF;

  IF EXISTS (SELECT 1 FROM "public"."SystemRoleScope" WHERE "role"::text = 'PLATFORM_ADMIN') THEN
    RAISE EXCEPTION 'Cannot remove PLATFORM_ADMIN from SystemRole: SystemRoleScope rows still reference it';
  END IF;
END $$;

-- Column default is typed as the old enum; PG cannot cast it when the column type changes.
ALTER TABLE "public"."User" ALTER COLUMN "system_role" DROP DEFAULT;

CREATE TYPE "public"."SystemRole_new" AS ENUM ('SERVICE', 'ADMIN', 'USER', 'ANON');

ALTER TABLE "public"."User"
  ALTER COLUMN "system_role" TYPE "public"."SystemRole_new"
  USING ("system_role"::text::"public"."SystemRole_new");

ALTER TABLE "public"."SystemRoleScope"
  ALTER COLUMN "role" TYPE "public"."SystemRole_new"
  USING ("role"::text::"public"."SystemRole_new");

DROP TYPE "public"."SystemRole";

ALTER TYPE "public"."SystemRole_new" RENAME TO "SystemRole";

ALTER TABLE "public"."User" ALTER COLUMN "system_role" SET DEFAULT 'USER'::"SystemRole";
