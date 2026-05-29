import { Prisma } from '@curvenote/scms-db';
import { getPrismaClient } from './prisma.server.js';

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
