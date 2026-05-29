import type { SiteContext } from '@curvenote/scms-server';
import { getPrismaClient } from '@curvenote/scms-server';
import { getWorkflow } from '@curvenote/scms-core';
import { firstVersionTag } from '../$siteName.submissions._index/index.versions.server.js';

export type VersionTimelineEntry = {
  id: string;
  date_created: string;
  date_published?: string;
  status: string;
  statusLabel: string;
  tag?: string;
};

/**
 * All submission versions for the version-timeline hover card (newest first).
 *
 * Single Prisma call:
 *   - Submission lookup is tenancy-scoped (`id` + `site_id`) — PK lookup with a
 *     bounded site filter, so plan picks the PK index.
 *   - Versions are fetched via the nested relation, which Prisma issues using
 *     the composite index `Submission_versions: (submission_id, date_created DESC)`
 *     declared on `SubmissionVersion` — see `prisma/schema/submission.prisma`.
 *
 * Selections are deliberately minimal: no `transition` JSON, no `metadata`,
 * no `work_version` join, and no submission columns at all. Workflow lookup
 * is local — only the workflow name travels from the DB.
 */
export async function dbLoadSubmissionVersionsTimeline(
  ctx: SiteContext,
  submissionId: string,
): Promise<VersionTimelineEntry[] | null> {
  const prisma = await getPrismaClient();

  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, site_id: ctx.site.id },
    select: {
      collection: { select: { workflow: true } },
      versions: {
        orderBy: { date_created: 'desc' },
        select: {
          id: true,
          date_created: true,
          date_published: true,
          status: true,
          tags: true,
        },
      },
    },
  });

  if (!submission) {
    return null;
  }

  const workflow = getWorkflow(ctx.$config, [], submission.collection.workflow);

  return submission.versions.map((row) => ({
    id: row.id,
    date_created: row.date_created,
    date_published: row.date_published ?? undefined,
    status: row.status,
    statusLabel: workflow.states[row.status]?.label ?? row.status,
    tag: firstVersionTag(row),
  }));
}
