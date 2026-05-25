import type { SiteContext } from '@curvenote/scms-server';
import { getPrismaClient, jobs } from '@curvenote/scms-server';
import { getWorkflow, KnownJobTypes } from '@curvenote/scms-core';
import { JobStatus } from '@curvenote/scms-db';
import { dbListSignedSubmissionsByIds } from '../$siteName.submissions._index/db.server.js';
import type { AugmentedSubmissionListingItem } from '../$siteName.submissions._index/types.js';

// TODO(perf): Replace full-site status scan with SQL filter on inbox workflow states.
// TODO(perf): Load running publish/unpublish jobs once per page instead of polling-only refresh.

async function dbFindInboxSubmissionIds(ctx: SiteContext): Promise<string[]> {
  const prisma = await getPrismaClient();
  const rows = await prisma.submission.findMany({
    where: { site_id: ctx.site.id },
    select: {
      id: true,
      collection: { select: { workflow: true } },
      versions: {
        select: { status: true },
        orderBy: { date_created: 'desc' },
        take: 1,
      },
    },
  });

  const inboxIds: string[] = [];
  for (const row of rows) {
    const status = row.versions[0]?.status;
    if (!status) continue;
    const workflow = getWorkflow(ctx.$config, [], row.collection.workflow);
    if (!workflow) continue;
    if (workflow.states[status]?.inbox) {
      inboxIds.push(row.id);
    }
  }
  return inboxIds;
}

function groupInboxItemsByStatus(
  ctx: SiteContext,
  items: AugmentedSubmissionListingItem[],
): { status: string; items: AugmentedSubmissionListingItem[] }[] {
  const groupedByStatus: Record<string, AugmentedSubmissionListingItem[]> = {};

  for (const item of items) {
    const workflow = item.workflow;
    if (!workflow) continue;
    const state = workflow.states[item.status];
    const status = state?.name || 'unknown';
    groupedByStatus[status] = [...(groupedByStatus[status] ?? []), item];
  }

  return Object.entries(groupedByStatus).map(([status, groupItems]) => ({
    status,
    items: groupItems,
  }));
}

/**
 * Inbox classic — local DB access; listing cards reuse submissions._index formatters.
 */
export async function dbGetInboxSubmissions(ctx: SiteContext) {
  const [jobsResult, inboxIds] = await Promise.all([
    jobs.list(
      ctx,
      ctx.site.id,
      [KnownJobTypes.PUBLISH, KnownJobTypes.UNPUBLISH],
      [JobStatus.RUNNING],
    ),
    dbFindInboxSubmissionIds(ctx),
  ]);

  const items = await dbListSignedSubmissionsByIds(ctx, inboxIds);
  const groups = groupInboxItemsByStatus(ctx, items);

  return {
    scopes: ctx.scopes,
    groups,
    jobs: jobsResult,
  };
}
