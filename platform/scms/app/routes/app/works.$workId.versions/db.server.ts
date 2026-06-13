import { getPrismaClient } from '@curvenote/scms-server';
import type { WorkVersionTimelineEntry } from '@curvenote/scms-core';

/**
 * All work versions for the version-timeline hover card (newest first).
 */
export async function dbLoadWorkVersionsTimeline(
  workId: string,
): Promise<WorkVersionTimelineEntry[]> {
  const prisma = await getPrismaClient();

  const rows = await prisma.workVersion.findMany({
    where: { work_id: workId },
    orderBy: { date_created: 'desc' },
    select: {
      id: true,
      date_created: true,
      date_modified: true,
      draft: true,
      tags: true,
    },
  });

  const finalizedAsc = rows
    .filter((row) => !row.draft)
    .slice()
    .sort((a, b) => Date.parse(a.date_created) - Date.parse(b.date_created));

  const labelById = new Map<string, string>();
  finalizedAsc.forEach((row, index) => {
    labelById.set(row.id, `v${index + 1}`);
  });

  return rows.map((row) => ({
    id: row.id,
    date_created: row.date_created,
    date_modified: row.date_modified,
    draft: row.draft,
    label: row.draft ? 'Draft' : (labelById.get(row.id) ?? 'Version'),
    tag: row.tags[0],
  }));
}
