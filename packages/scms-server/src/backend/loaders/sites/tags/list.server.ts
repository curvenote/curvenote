import { getPrismaClient } from '../../../prisma.server.js';
import type { TagCatalogRow, TagRow } from './format.server.js';

const TAG_SELECT = { id: true, name: true, label: true } as const;
const CATALOG_TAG_SELECT = {
  ...TAG_SELECT,
  date_created: true,
  _count: { select: { submissions: true } },
} as const;

/** Every tag defined on the site, assigned or not, ordered by label. */
export async function dbListSiteTags(siteId: string): Promise<TagRow[]> {
  const prisma = await getPrismaClient();
  return prisma.tag.findMany({
    where: { site_id: siteId },
    select: TAG_SELECT,
    orderBy: { label: 'asc' },
  });
}

/**
 * Catalog table rows, including `date_created` and `submission_count`. The
 * count covers every submission with the tag, listed or not, because deleting
 * the tag removes it from all of them. Ordered by label.
 */
export async function dbListSiteTagsForCatalog(siteId: string): Promise<TagCatalogRow[]> {
  const prisma = await getPrismaClient();
  const rows = await prisma.tag.findMany({
    where: { site_id: siteId },
    select: CATALOG_TAG_SELECT,
    orderBy: { label: 'asc' },
  });
  return rows.map(({ _count, ...row }) => ({ ...row, submission_count: _count.submissions }));
}

/** Tags assigned to one submission, ordered by label. */
export async function dbListTagsForSubmission(submissionId: string): Promise<TagRow[]> {
  const prisma = await getPrismaClient();
  const rows = await prisma.tagsInSubmissions.findMany({
    where: { submission_id: submissionId },
    select: { tag: { select: TAG_SELECT } },
    orderBy: { tag: { label: 'asc' } },
  });
  return rows.map((row) => row.tag);
}
