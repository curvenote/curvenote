import { httpError } from '@curvenote/scms-core';
import { getPrismaClient } from '../../../prisma.server.js';

export type DeleteSiteTagParams = {
  siteId: string;
  tagId: string;
};

/**
 * Delete a catalog tag. `TagsInSubmissions` rows cascade at the database.
 * No activity, no submission touch.
 */
export async function deleteSiteTag(params: DeleteSiteTagParams): Promise<void> {
  const prisma = await getPrismaClient();
  const existing = await prisma.tag.findFirst({
    where: { id: params.tagId, site_id: params.siteId },
    select: { id: true },
  });
  if (!existing) {
    throw httpError(404, 'tag not found on this site');
  }

  await prisma.tag.delete({
    where: { id: existing.id },
    select: { id: true },
  });
}
