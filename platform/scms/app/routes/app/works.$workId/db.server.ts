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

/** Get the work creator/owner display name (Work.created_by). Used for timeline "Version created by". */
export async function dbGetWorkOwnerName(workId: string): Promise<string | null> {
  const prisma = await getPrismaClient();
  const work = await prisma.work.findUnique({
    where: { id: workId },
    select: { created_by: { select: { display_name: true } } },
  });
  return work?.created_by?.display_name ?? null;
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
          submitted_by: { select: { id: true, display_name: true } },
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

/** Activity row for work timeline: id, date, type, who, and which work version. */
export type WorkActivityRow = {
  id: string;
  date_created: string;
  activity_type: string;
  activity_by: { id: string; display_name: string | null };
  work_version_id: string | null;
  submission?: { site: { name: string; title: string | null } };
};

/** Activities for a work (filtered to this work). Group by work_version_id in the UI. */
export async function dbGetWorkActivities(workId: string): Promise<WorkActivityRow[]> {
  const prisma = await getPrismaClient();
  const rows = await prisma.activity.findMany({
    where: { work_id: workId },
    orderBy: { date_created: 'desc' },
    include: {
      activity_by: { select: { id: true, display_name: true } },
      work_version: { select: { id: true } },
      submission: { select: { site: { select: { name: true, title: true } } } },
    },
  });
  return rows.map((a) => ({
    id: a.id,
    date_created: a.date_created,
    activity_type: a.activity_type,
    activity_by: a.activity_by,
    work_version_id: a.work_version_id,
    submission: a.submission
      ? { site: a.submission.site as { name: string; title: string | null } }
      : undefined,
  }));
}
