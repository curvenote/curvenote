import { getPrismaClient } from '@curvenote/scms-server';

export async function dbSetSiteRestricted(siteId: string, restricted: boolean) {
  const prisma = await getPrismaClient();
  return prisma.site.update({
    where: { id: siteId },
    data: {
      restricted,
      date_modified: new Date().toISOString(),
    },
  });
}
