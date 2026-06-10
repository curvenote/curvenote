import { Prisma } from '@curvenote/scms-db';
import { getPrismaClient } from './prisma.server.js';

/** Postgres `#>>` text-array literal for `metadata['frontmatter.myst'].subject`. */
export const WORK_VERSION_SUBJECT_JSON_PATH = "'{frontmatter.myst,subject}'";

/**
 * Postgres normalizer for subject equality filters. Must match
 * `work_version_subject_normalized()` and `WorkVersion_subject_normalized_idx`
 * (migration `20260609120000_add_work_version_subject_normalized_index`).
 */
export const WORK_VERSION_SUBJECT_NORMALIZED_FN = 'work_version_subject_normalized';

/**
 * Read `subject` from `metadata['frontmatter.myst'].subject`.
 */
export function extractWorkVersionSubjectFromMetadata(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const myst = (metadata as Record<string, unknown>)['frontmatter.myst'];
  if (!myst || typeof myst !== 'object') return undefined;

  const subject = (myst as Record<string, unknown>).subject;
  if (typeof subject !== 'string') return undefined;

  const trimmed = subject.trim();
  return trimmed || undefined;
}

/**
 * Batch-fetch `subject` for work versions using Postgres JSON-path operators so
 * only the scalar is read from the row, not the full metadata blob.
 */
export async function fetchWorkVersionSubjects(
  workVersionIds: string[],
  tx?: Prisma.TransactionClient,
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(workVersionIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const prisma = await getPrismaClient();
  const rows = await (tx ?? prisma).$queryRaw<{ id: string; subject: string | null }[]>`
    SELECT
      wv.id,
      wv.metadata #>> ${Prisma.raw(WORK_VERSION_SUBJECT_JSON_PATH)} AS subject
    FROM "WorkVersion" wv
    WHERE wv.id IN (${Prisma.join(uniqueIds)})
  `;

  const subjects = new Map<string, string>();
  for (const row of rows) {
    const subject = row.subject?.trim();
    if (subject) subjects.set(row.id, subject);
  }
  return subjects;
}

/**
 * Resolve submission ids whose work metadata subject matches exactly (case- and
 * whitespace-insensitive). Scoped to versions in the requested listing status,
 * mirroring the public works listing semijoin.
 *
 * Starts from `WorkVersion` rows matching the subject (index-backed via
 * `WorkVersion_subject_normalized_idx`) and joins back to submissions on the
 * site rather than scanning every submission with an EXISTS subquery.
 *
 * `wv.metadata IS NOT NULL` is required so the planner can use the partial
 * index (`WHERE metadata IS NOT NULL` on `WorkVersion_subject_normalized_idx`).
 */
export async function fetchSubmissionIdsBySubject(
  siteId: string,
  subject: string,
  status: string,
  tx?: Prisma.TransactionClient,
): Promise<string[]> {
  const normalized = subject.trim();
  if (!normalized) return [];

  const prisma = await getPrismaClient();
  const rows = await (tx ?? prisma).$queryRaw<{ id: string }[]>`
    SELECT DISTINCT s.id
    FROM "WorkVersion" wv
    INNER JOIN "SubmissionVersion" sv
      ON sv.work_version_id = wv.id
     AND sv.status = ${status}
    INNER JOIN "Submission" s
      ON s.id = sv.submission_id
     AND s.site_id = ${siteId}
    WHERE wv.metadata IS NOT NULL
      AND ${Prisma.raw(WORK_VERSION_SUBJECT_NORMALIZED_FN)}(wv.metadata) = LOWER(${normalized})
  `;
  return rows.map((row) => row.id);
}
