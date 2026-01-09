-- DropForeignKey
-- Remove FK constraint to allow deletion of MagicLink while preserving access logs for audit purposes
ALTER TABLE "MagicLinkAccess" DROP CONSTRAINT "MagicLinkAccess_magic_link_id_fkey";
