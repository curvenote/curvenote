import type { SiteContext } from '@curvenote/scms-server';
import { jobs, sites, getPrismaClient } from '@curvenote/scms-server';
import { JobStatus } from '@prisma/client';
import { getWorkflow, KnownJobTypes } from '@curvenote/scms-core';

/**
 * Retrieves inbox submissions for a given site.
 *
 * @param ctx - The site context.
 * @returns An object containing the scopes, pending submissions, updates, and jobs.
 */
export async function dbGetInboxSubmissions(ctx: SiteContext) {
  const jobsQuery = jobs.list(
    ctx,
    ctx.site.id,
    [KnownJobTypes.PUBLISH, KnownJobTypes.UNPUBLISH],
    [JobStatus.RUNNING],
  );

  // this will fix inbox temporarily, but we need to address the active version selection
  const prisma = await getPrismaClient();
  const submissionsWithLatestVersion = await prisma.submission.findMany({
    include: {
      collection: true,
      versions: {
        orderBy: {
          date_created: 'desc',
        },
        take: 1, // Take only the most recent version
      },
    },
  });

  // Filter submissions based on workflow states
  const inboxIdsPromises = submissionsWithLatestVersion.map(async (s) => {
    const status = s.versions[0].status;
    const workflow = getWorkflow(ctx.$config, [], s.collection.workflow);
    if (!workflow) return null;
    const state = workflow.states[status];
    // Include submissions that are in states that require attention
    return state?.inbox ? s.id : null;
  });
  const inboxIds = (await Promise.all(inboxIdsPromises)).filter((id): id is string => id !== null);

  const allWithInboxStatuses = sites.submissions.list(ctx, [], { id: { in: inboxIds } });

  const [jobsResult, anyWithPending] = await Promise.all([jobsQuery, allWithInboxStatuses]);

  const groupedByStatus: Record<
    string,
    Awaited<ReturnType<typeof sites.submissions.list>>['items']
  > = {};
  await Promise.all(
    anyWithPending.items.map(async (s) => {
      const workflow = getWorkflow(ctx.$config, [], s.collection.workflow);
      if (!workflow) return;
      const state = workflow.states[s.active_version.status];
      const status = state?.name || 'unknown';
      groupedByStatus[status] = [...(groupedByStatus[status] || []), s];
    }),
  );

  const groups = Object.entries(groupedByStatus).map(([status, i]) => ({
    status,
    items: i,
  }));

  return {
    scopes: ctx.scopes,
    groups,
    jobs: jobsResult,
  };
}
