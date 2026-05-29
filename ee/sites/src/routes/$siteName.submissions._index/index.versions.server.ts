import { getPrismaClient } from '@curvenote/scms-server';
import type { Prisma } from '@curvenote/scms-db';

type VersionDateRow = {
  submission_id: string;
  date_created: string;
};

const distinctVersionOrderBy = [
  { submission_id: 'asc' as const },
  { date_created: 'desc' as const },
];

async function dbDistinctVersionDates(
  submissionIds: string[],
  where: Prisma.SubmissionVersionWhereInput,
): Promise<VersionDateRow[]> {
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
    select: {
      submission_id: true,
      date_created: true,
    },
  });
}

export type IndexVersionDates = {
  publishedVersion?: { date_created: string };
  retractedVersion?: { date_created: string };
};

type VersionTagSource = {
  tags: string[];
};

/**
 * First tag on the submission version — same source as title/status on the listing card.
 * Intentionally ignores `work_version.tags`: the listing badge reflects the tag chosen
 * for this submission, not tags inherited from the underlying work version.
 */
export function firstVersionTag(row: VersionTagSource): string | undefined {
  return row.tags?.[0];
}

/**
 * Latest published / retracted version dates per submission — enough for listing chips.
 */
export async function dbLoadIndexVersionDates(
  submissionIds: string[],
): Promise<Map<string, IndexVersionDates>> {
  if (submissionIds.length === 0) {
    return new Map();
  }

  const [publishedRows, retractedRows] = await Promise.all([
    dbDistinctVersionDates(submissionIds, { status: 'PUBLISHED' }),
    dbDistinctVersionDates(submissionIds, { status: 'RETRACTED' }),
  ]);

  const publishedBySubmission = new Map(publishedRows.map((row) => [row.submission_id, row]));
  const retractedBySubmission = new Map(retractedRows.map((row) => [row.submission_id, row]));

  const result = new Map<string, IndexVersionDates>();
  for (const submissionId of submissionIds) {
    const published = publishedBySubmission.get(submissionId);
    const retracted = retractedBySubmission.get(submissionId);
    if (!published && !retracted) continue;
    result.set(submissionId, {
      publishedVersion: published ? { date_created: published.date_created } : undefined,
      retractedVersion: retracted ? { date_created: retracted.date_created } : undefined,
    });
  }

  return result;
}
