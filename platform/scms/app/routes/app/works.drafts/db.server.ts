import { getPrismaClient } from '@curvenote/scms-server';
import type { WorkRole } from '@curvenote/scms-db';

/**
 * Fetches works that are excluded from the main My Works listing (draft works):
 * 1. Works where every work version has draft = true (single or multiple versions, all draft)
 * 2. Works with a single work version and a single submission that has only DRAFT submission versions
 *
 * Inverse of the logic in works._index. Submissions are returned with all versions (including DRAFT)
 * so the UI can show draft submission state.
 */
export async function dbGetDraftWorks(userId: string) {
  const prisma = await getPrismaClient();
  const works = await prisma.work.findMany({
    where: {
      work_users: {
        some: {
          user_id: userId,
        },
      },
    },
    include: {
      work_users: {
        where: {
          user_id: userId,
        },
        select: {
          role: true,
        },
      },
      submissions: {
        include: {
          site: true,
          slugs: true,
          collection: true,
          activity: {
            include: {
              activity_by: true,
            },
            orderBy: {
              date_created: 'desc',
            },
            take: 1,
          },
          versions: {
            include: {
              submission: {
                include: {
                  site: true,
                  collection: true,
                },
              },
              work_version: true,
            },
            orderBy: {
              date_created: 'desc',
            },
          },
        },
      },
      versions: {
        orderBy: {
          date_created: 'desc',
        },
      },
    },
    orderBy: {
      date_created: 'desc',
    },
    take: 100,
  });

  return works
    .map((work) => {
      const rawSubmissionCount = work.submissions.length;
      const allVersionsAreDraft = work.versions.length > 0 && work.versions.every((v) => v.draft);
      const singleVersionSingleDraftSubmission =
        work.versions.length === 1 &&
        rawSubmissionCount === 1 &&
        (work.submissions[0]?.versions ?? []).every((v) => v.status === 'DRAFT');

      const includeInDrafts = allVersionsAreDraft || singleVersionSingleDraftSubmission;
      if (!includeInDrafts) return null;

      const userRoles = work.work_users.map((wu) => wu.role);
      let userRole: WorkRole | 'ORPHANED' = 'ORPHANED';
      if (userRoles.includes('OWNER')) userRole = 'OWNER';
      else if (userRoles.includes('CONTRIBUTOR')) userRole = 'CONTRIBUTOR';
      else if (userRoles.includes('VIEWER')) userRole = 'VIEWER';

      const draftKind = allVersionsAreDraft
        ? ('work_version_draft' as const)
        : ('submission_draft' as const);

      return {
        ...work,
        userRole,
        draftKind,
      };
    })
    .filter((w): w is NonNullable<typeof w> => w !== null);
}

export type DraftWorkItem = Awaited<ReturnType<typeof dbGetDraftWorks>>[number];
