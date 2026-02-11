import { getPrismaClient } from '@curvenote/scms-server';

export type LinkedJobWithStatus = { id: string; status: string };

export async function dbGetLinkedJobsByWorkVersionIds(
  workVersionIds: string[],
): Promise<Record<string, LinkedJobWithStatus[]>> {
  if (workVersionIds.length === 0) return {};
  const prisma = await getPrismaClient();
  const rows = await prisma.linkedJob.findMany({
    where: { work_version_id: { in: workVersionIds } },
    include: { job: { select: { id: true, status: true } } },
  });
  const map: Record<string, LinkedJobWithStatus[]> = {};
  for (const row of rows) {
    const list = map[row.work_version_id] ?? [];
    list.push({ id: row.job.id, status: row.job.status });
    map[row.work_version_id] = list;
  }
  return map;
}

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
