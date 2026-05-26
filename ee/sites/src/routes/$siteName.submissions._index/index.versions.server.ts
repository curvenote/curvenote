import { concatSiteWorkTags } from '@curvenote/common';
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
  versionTag?: string;
};

type VersionTagRow = {
  submission_id: string;
  tags: string[];
  work_version: { tags: string[] };
};

export function pickLatestVersionTags(rows: VersionTagRow[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const row of rows) {
    if (result.has(row.submission_id)) continue;
    const tags = concatSiteWorkTags(row.tags ?? [], row.work_version.tags ?? []);
    if (tags.length > 0) {
      result.set(row.submission_id, tags[0]);
    }
  }
  return result;
}

async function dbLatestVersionTags(submissionIds: string[]): Promise<Map<string, string>> {
  if (submissionIds.length === 0) {
    return new Map();
  }

  const prisma = await getPrismaClient();
  // DISTINCT ON (submission_id) with date_created DESC — one row per submission (the
  // newest version that has tags), not every tagged version for those submissions.
  const rows = await prisma.submissionVersion.findMany({
    where: {
      submission_id: { in: submissionIds },
      OR: [{ tags: { isEmpty: false } }, { work_version: { tags: { isEmpty: false } } }],
    },
    distinct: ['submission_id'],
    orderBy: distinctVersionOrderBy,
    select: {
      submission_id: true,
      tags: true,
      work_version: { select: { tags: true } },
    },
  });

  return pickLatestVersionTags(rows);
}

/**
 * Latest published / retracted version dates and version tag per submission — enough for listing chips.
 */
export async function dbLoadIndexVersionDates(
  submissionIds: string[],
): Promise<Map<string, IndexVersionDates>> {
  if (submissionIds.length === 0) {
    return new Map();
  }

  const [publishedRows, retractedRows, versionTagBySubmission] = await Promise.all([
    dbDistinctVersionDates(submissionIds, { status: 'PUBLISHED' }),
    dbDistinctVersionDates(submissionIds, { status: 'RETRACTED' }),
    dbLatestVersionTags(submissionIds),
  ]);

  const publishedBySubmission = new Map(publishedRows.map((row) => [row.submission_id, row]));
  const retractedBySubmission = new Map(retractedRows.map((row) => [row.submission_id, row]));

  const result = new Map<string, IndexVersionDates>();
  for (const submissionId of submissionIds) {
    const published = publishedBySubmission.get(submissionId);
    const retracted = retractedBySubmission.get(submissionId);
    const versionTag = versionTagBySubmission.get(submissionId);
    if (!published && !retracted && !versionTag) continue;
    result.set(submissionId, {
      publishedVersion: published ? { date_created: published.date_created } : undefined,
      retractedVersion: retracted ? { date_created: retracted.date_created } : undefined,
      versionTag,
    });
  }

  return result;
}
