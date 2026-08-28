import { WorkContents } from '@curvenote/scms-core';
import { getPrismaClient } from '../prisma.server.js';

/**
 * Find draft works for a user that have exactly one work version and that version is draft.
 * Used for the "Resume draft" dialog on My Works / New Work so we only show works that
 * were started from this flow (single-version drafts). Works with multiple versions
 * (e.g. new version on top) are managed from the Work Details page instead.
 */
export async function dbFindSingleVersionDraftFileWorksForUser(userId: string) {
  const prisma = await getPrismaClient();

  const works = await prisma.work.findMany({
    where: {
      work_users: {
        some: {
          user_id: userId,
        },
      },
      contains: {
        has: WorkContents.FILES,
      },
      versions: {
        some: {
          draft: true,
        },
      },
    },
    include: {
      versions: {
        orderBy: {
          date_created: 'desc',
        },
      },
    },
    orderBy: {
      date_modified: 'desc',
    },
  });

  return works.filter((work) => work.versions.length === 1 && work.versions[0].draft === true);
}
