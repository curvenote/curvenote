import { getPrismaClient } from '@curvenote/scms-server';
import type { Prisma } from '@curvenote/scms-db';
import { mergeListingVersionChips, type ListingVersionChip } from './listing.utils.server.js';

const listingVersionSelect = {
  id: true,
  submission_id: true,
  status: true,
  date_created: true,
  transition: true,
  job_id: true,
  work_version: { select: { work_id: true } },
} satisfies Prisma.SubmissionVersionSelect;

const distinctVersionOrderBy = [
  { submission_id: 'asc' as const },
  { date_created: 'desc' as const },
];

async function dbDistinctVersionsPerSubmission(
  submissionIds: string[],
  where: Prisma.SubmissionVersionWhereInput,
): Promise<ListingVersionChip[]> {
  if (submissionIds.length === 0) {
    return [];
  }
  const prisma = await getPrismaClient();
  return prisma.submissionVersion.findMany({
    where: {
      submission_id: { in: submissionIds },
      ...where,
    },
    distinct: ['submission_id'],
    orderBy: distinctVersionOrderBy,
    select: listingVersionSelect,
  });
}

/**
 * Loads at most three version rows per submission (newest, latest published, latest retracted)
 * instead of every version — enough for findImportantVersions / listing cards.
 */
export async function dbLoadListingVersionSnapshots(
  submissionIds: string[],
): Promise<Map<string, ListingVersionChip[]>> {
  if (submissionIds.length === 0) {
    return new Map();
  }

  const [newestRows, publishedRows, retractedRows] = await Promise.all([
    dbDistinctVersionsPerSubmission(submissionIds, {}),
    dbDistinctVersionsPerSubmission(submissionIds, { status: 'PUBLISHED' }),
    dbDistinctVersionsPerSubmission(submissionIds, { status: 'RETRACTED' }),
  ]);

  const newestBySubmission = new Map(newestRows.map((row) => [row.submission_id, row]));
  const publishedBySubmission = new Map(publishedRows.map((row) => [row.submission_id, row]));
  const retractedBySubmission = new Map(retractedRows.map((row) => [row.submission_id, row]));

  const result = new Map<string, ListingVersionChip[]>();
  for (const submissionId of submissionIds) {
    const versions = mergeListingVersionChips({
      newest: newestBySubmission.get(submissionId),
      published: publishedBySubmission.get(submissionId),
      retracted: retractedBySubmission.get(submissionId),
    });
    if (versions.length > 0) {
      result.set(submissionId, versions);
    }
  }

  return result;
}
