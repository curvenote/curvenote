import { getPrismaClient } from '@curvenote/scms-server';
import type { WorkVersionDBO } from '@curvenote/scms-server';
import { WorkContents } from '@curvenote/scms-core';

/**
 * Find all draft works for a user that contain 'files'
 * Returns works with their draft versions, ordered by most recent first
 */
export async function dbFindDraftFileWorksForUser(userId: string) {
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
        where: {
          draft: true,
        },
        orderBy: {
          date_created: 'desc',
        },
      },
    },
    orderBy: {
      date_modified: 'desc',
    },
  });

  return works;
}

/**
 * Check if a work version is "untouched" (hasn't been used yet)
 * An untouched work version has:
 * - Empty or default title
 * - Empty/null description
 * - No files uploaded in metadata
 */
export function isWorkVersionUntouched(version: WorkVersionDBO): boolean {
  // Check title - empty or default untitled variations
  const hasEmptyTitle =
    !version.title ||
    version.title === '' ||
    version.title.toLowerCase() === 'untitled' ||
    version.title.toLowerCase() === 'untitled work';

  // Check description - empty or null
  const hasEmptyDescription = !version.description || version.description === '';

  // Check metadata.files - no files uploaded
  const metadata = version.metadata as any;
  const hasNoFiles = !metadata?.files || Object.keys(metadata.files).length === 0;

  return hasEmptyTitle && hasEmptyDescription && hasNoFiles;
}

/**
 * Update both Work and WorkVersion timestamps to "refresh" a draft
 * This makes the draft appear at the top of the user's work list
 */
export async function dbUpdateWorkAndVersionTimestamps(workId: string, versionId: string) {
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();

  await prisma.$transaction([
    prisma.work.update({
      where: { id: workId },
      data: { date_modified: now },
    }),
    prisma.workVersion.update({
      where: { id: versionId },
      data: { date_modified: now },
    }),
  ]);
}
