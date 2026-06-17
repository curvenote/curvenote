-- Preferred thumbnail storage key for a work version (layer 1 of the thumbnail
-- cascade). Nullable; populated by the upload flow when a user selects a thumbnail.
ALTER TABLE "WorkVersion" ADD COLUMN "thumbnail" TEXT;
