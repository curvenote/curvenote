import { Prisma } from '@curvenote/scms-db';
import { getPrismaClient } from './prisma.server.js';

/** Postgres `#>>` path for `metadata['frontmatter.myst'].project.subject`. */
export const WORK_VERSION_SUBJECT_JSON_PATH = '{frontmatter.myst,project,subject}';

/**
 * Read `project.subject` from `metadata['frontmatter.myst'].project.subject`.
 */
export function extractWorkVersionSubjectFromMetadata(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const myst = (metadata as Record<string, unknown>)['frontmatter.myst'];
  if (!myst || typeof myst !== 'object') return undefined;

  const project = (myst as Record<string, unknown>).project;
  if (!project || typeof project !== 'object') return undefined;

  const subject = (project as Record<string, unknown>).subject;
  if (typeof subject !== 'string') return undefined;

  const trimmed = subject.trim();
  return trimmed || undefined;
}

/**
 * Batch-fetch `project.subject` for work versions using Postgres JSON-path
 * operators so only the scalar is read from the row, not the full metadata blob.
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
      wv.metadata #>> '{frontmatter.myst,project,subject}' AS subject
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
    SELECT s.id
    FROM "Submission" s
    WHERE s.site_id = ${siteId}
      AND EXISTS (
        SELECT 1
        FROM "SubmissionVersion" sv
        JOIN "WorkVersion" wv ON wv.id = sv.work_version_id
        WHERE sv.submission_id = s.id
          AND sv.status = ${status}
          AND LOWER(TRIM(wv.metadata #>> '{frontmatter.myst,project,subject}')) = LOWER(${normalized})
      )
  `;
  return rows.map((row) => row.id);
}
