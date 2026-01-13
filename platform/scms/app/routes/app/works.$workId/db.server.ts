import { getPrismaClient } from '@curvenote/scms-server';

export async function dbGetWorkVersionsWithSubmissionVersions(workId: string) {
  const prisma = await getPrismaClient();
  const workVersions = await prisma.workVersion.findMany({
    where: { work_id: workId },
    orderBy: {
      date_created: 'desc',
    },
    include: {
      submissionVersions: {
        include: {
          submission: {
            include: {
              collection: true,
              site: true,
            },
          },
        },
        orderBy: {
          date_created: 'desc',
        },
      },
    },
  });
  return workVersions;
}

export async function dbGetSubmission(submissionId: string) {
  const prisma = await getPrismaClient();
  const work = await prisma.submission.findFirst({
    where: { id: submissionId },
    include: {
      site: true,
      collection: true,
      versions: true,
    },
  });
  return work;
}

export async function dbGetSubmissions(submissionIds: string[]) {
  const prisma = await getPrismaClient();
  const submissions = await prisma.submission.findMany({
    where: {
      id: {
        in: submissionIds,
      },
    },
    include: {
      site: true,
      collection: true,
      versions: true,
    },
  });
  return submissions;
}
