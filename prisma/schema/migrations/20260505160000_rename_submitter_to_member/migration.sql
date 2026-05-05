-- Rename SiteRole enum value; preserves existing SiteUser rows.
ALTER TYPE "SiteRole" RENAME VALUE 'SUBMITTER' TO 'MEMBER';
