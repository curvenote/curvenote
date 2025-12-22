import { getPrismaClient } from '@curvenote/scms-server';

export async function dbCountSites() {
  const prisma = await getPrismaClient();
  return prisma.site.count();
}

export async function dbCountSubmissionsByStatus() {
  const prisma = await getPrismaClient();

  // Count published submissions (latest version status = PUBLISHED)
  const publishedCount = await prisma.submissionVersion.count({
    where: {
      status: 'PUBLISHED',
    },
  });

  // Count draft submissions (latest version status = DRAFT)
  const draftCount = await prisma.submissionVersion.count({
    where: {
      status: 'DRAFT',
    },
  });

  return {
    published: publishedCount,
    draft: draftCount,
  };
}

export async function dbGetPlatformAnalyticsDashboards() {
  const prisma = await getPrismaClient();
  return prisma.analyticsDashboard.findMany({
    where: {
      type: 'PLATFORM',
      enabled: true,
    },
    orderBy: {
      title: 'asc',
    },
  });
}
