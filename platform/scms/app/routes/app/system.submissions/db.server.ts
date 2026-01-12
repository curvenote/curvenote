import { getPrismaClient } from '@curvenote/scms-server';
import { firstPublishedVersionDateCreated, lastPublishedVersionWorkDate } from './utils';

export async function dbGetSiteSubmission(siteName: string) {
  const prisma = await getPrismaClient();
  return prisma?.submission.findMany({
    where: {
      site: {
        name: siteName,
      },
    },
    include: {
      kind: true,
      collection: true,
      versions: {
        orderBy: {
          date_created: 'desc',
        },
        include: {
          work_version: {
            include: {
              work: {
                include: {
                  work_users: {
                    include: {
                      user: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [
      {
        date_published: 'desc', // Null values (never published submissions) come first, then are ordered by date_created
      },
      {
        date_created: 'desc',
      },
    ],
  });
}

export type SubmissionTreeDBO = Awaited<ReturnType<typeof dbGetSiteSubmission>>;

async function dbUpdateDatePublishedHelper(
  siteName: string,
  getDate: (item: SubmissionTreeDBO[0]) => string | undefined,
) {
  const allSubmissions = await dbGetSiteSubmission(siteName);
  const prisma = await getPrismaClient();
  await Promise.all(
    allSubmissions.map(async (submission) => {
      if (submission.date_published) return;
      const date_published = getDate(submission);
      if (!date_published) return;
      await prisma?.submission.update({
        where: {
          id: submission.id,
        },
        data: {
          date_published,
          date_modified: new Date().toISOString(),
        },
      });
    }),
  );
}

export async function dbUpdateDatePublishedFromWork(siteName: string) {
  await dbUpdateDatePublishedHelper(siteName, lastPublishedVersionWorkDate);
}

export async function dbUpdateDatePublishedFromVersion(siteName: string) {
  await dbUpdateDatePublishedHelper(siteName, firstPublishedVersionDateCreated);
}
