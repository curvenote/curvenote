import { getPrismaClient } from '@curvenote/scms-server';

export async function dbGetSiteAnalyticsDashboards(siteId: string) {
  const prisma = await getPrismaClient();
  return prisma.analyticsDashboard.findMany({
    where: {
      type: 'SITE',
      site_id: siteId,
      enabled: true,
    },
    include: {
      site: {
        select: {
          id: true,
          name: true,
          title: true,
        },
      },
    },
    orderBy: {
      title: 'asc',
    },
  });
}

export async function dbGetSiteSubmissionStats(siteId: string) {
  const prisma = await getPrismaClient();

  // Count total submissions for this site
  const totalSubmissions = await prisma.submission.count({
    where: {
      site_id: siteId,
    },
  });

  // Count submissions by status (using latest version status)
  const submissionsByStatus = await prisma.submissionVersion.groupBy({
    by: ['status'],
    where: {
      submission: {
        site_id: siteId,
      },
    },
    _count: {
      id: true,
    },
  });

  // Count submissions by kind (through kind relation)
  const submissionsByKind = await prisma.submission.groupBy({
    by: ['kind_id'],
    where: {
      site_id: siteId,
    },
    _count: {
      id: true,
    },
  });

  // Get kind names for the IDs
  const kindIds = submissionsByKind.map((item) => item.kind_id);
  const kinds = await prisma.submissionKind.findMany({
    where: {
      id: { in: kindIds },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const kindMap = kinds.reduce(
    (acc, kind) => {
      acc[kind.id] = kind.name;
      return acc;
    },
    {} as Record<string, string>,
  );

  // Count submissions by collection (through collection relation)
  const submissionsByCollection = await prisma.submission.groupBy({
    by: ['collection_id'],
    where: {
      site_id: siteId,
    },
    _count: {
      id: true,
    },
  });

  // Get collection names for the IDs
  const collectionIds = submissionsByCollection.map((item) => item.collection_id);
  const collections = await prisma.collection.findMany({
    where: {
      id: { in: collectionIds },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const collectionMap = collections.reduce(
    (acc, collection) => {
      acc[collection.id] = collection.name;
      return acc;
    },
    {} as Record<string, string>,
  );

  return {
    totalSubmissions,
    byStatus: submissionsByStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      },
      {} as Record<string, number>,
    ),
    byKind: submissionsByKind.reduce(
      (acc, item) => {
        const kindName = kindMap[item.kind_id] || 'Unknown';
        acc[kindName] = item._count.id;
        return acc;
      },
      {} as Record<string, number>,
    ),
    byCollection: submissionsByCollection.reduce(
      (acc, item) => {
        const collectionName = collectionMap[item.collection_id] || 'No Collection';
        acc[collectionName] = item._count.id;
        return acc;
      },
      {} as Record<string, number>,
    ),
  };
}
