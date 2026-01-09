/*
  Manually generated steps:

  - change microscopy footer content

*/
-- AlterTable
UPDATE "Site"
SET metadata = jsonb_set(metadata, '{footer_links, 1, 0, url}', '"/writing-an-article"')
WHERE "name" = 'microscopy';
