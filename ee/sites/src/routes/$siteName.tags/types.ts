import { sites } from '@curvenote/scms-server';

export type TagCatalogRow = Awaited<ReturnType<typeof sites.tags.dbListSiteTagsForCatalog>>[number];
