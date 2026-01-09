import { getPrismaClient } from '@curvenote/scms-server';

export async function getSubmissionVersionsForWorkAndSite(workId: string, siteName: string) {
  const prisma = await getPrismaClient();
  return prisma.submissionVersion.findMany({
    where: {
      work_version: {
        work_id: workId,
      },
      submission: {
        site: {
          name: siteName,
        },
      },
    },
    include: {
      work_version: true,
      submission: {
        include: {
          site: true,
          collection: true,
          submitted_by: true,
        },
      },
    },
    orderBy: { date_created: 'desc' },
  });
}

export async function getSubmissionForWorkAndSite(workId: string, siteName: string) {
  const prisma = await getPrismaClient();

  return prisma.submission.findFirst({
    where: {
      site: {
        name: siteName,
      },
      versions: {
        some: {
          work_version: {
            work_id: workId,
          },
        },
      },
    },
    include: {
      site: true,
      collection: true,
      submitted_by: true,
      kind: true,
      slugs: true,
    },
  });
}

export async function getSubmissionVersion(submissionVersionId: string) {
  const prisma = await getPrismaClient();
  return prisma.submissionVersion.findUnique({
    where: {
      id: submissionVersionId,
    },
    include: {
      work_version: {
        include: {
          work: true,
        },
      },
      submission: {
        include: {
          site: true,
          collection: true,
          submitted_by: true,
          kind: true,
        },
      },
    },
  });
}
