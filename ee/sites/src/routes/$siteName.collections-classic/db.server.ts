import type { Prisma } from '@curvenote/scms-db';
import { getPrismaClient } from '@curvenote/scms-server';
import type { dbListCollections } from '../$siteName.collections/db.server.js';

export async function dbListSubmissionKinds(siteId: string) {
  const prisma = await getPrismaClient();
  return prisma.submissionKind.findMany({
    where: {
      site: {
        id: siteId,
      },
    },
    orderBy: {
      name: 'asc',
    },
  });
}

export type KindsDBO = Awaited<ReturnType<typeof dbListSubmissionKinds>>;
export type CollectionsDBO = Awaited<ReturnType<typeof dbListCollections>>;
