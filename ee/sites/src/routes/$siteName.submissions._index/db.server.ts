import type { SiteContext } from '@curvenote/scms-server';
import { createPreviewToken, getPrismaClient, sites, jobs } from '@curvenote/scms-server';
import type { Prisma } from '@curvenote/scms-db';
import { $Enums } from '@curvenote/scms-db';
import { getWorkflow, KnownJobTypes } from '@curvenote/scms-core';

/**
 * Counts the total number of submissions matching the given where clause
 * by using the same list function as the main query and counting the results
 */
async function countSubmissions(ctx: SiteContext, where: Prisma.SubmissionWhereInput) {
  const prisma = await getPrismaClient();

  // Use the same query as the list function but with minimal select
  // This ensures we get exactly the same filtering logic
  const submissions = await prisma.submission.findMany({
    where: {
      site: { name: ctx.site.name },
      ...where,
    },
    select: {
      id: true,
      versions: {
        select: {
          id: true, // Only need to know if versions exist, so just select id
        },
      },
    },
  });

  // Apply the same filtering logic as formatSubmissionItemDTO
  // Filter out submissions with no versions (these return null in the loader)
  const filteredSubmissions = submissions.filter((s) => s.versions.length > 0);

  return filteredSubmissions.length;
}

/**
 * Retrieves a list of submissions for a site with their associated workflow information and preview signatures.
 *
 * @param ctx - The site context containing site information and configuration
 * @param moreWhere - Optional additional Prisma where conditions to filter submissions
 * @param skip - Number of records to skip
 * @param take - Number of records to take
 * @returns An object containing an array of submissions with workflow and signature information, and total count
 */
export async function dbListSignedSubmissions(
  ctx: SiteContext,
  moreWhere?: Prisma.SubmissionWhereInput,
  page?: number,
  perPage?: number,
) {
  const where = {
    ...moreWhere,
    // critical to ensure that drafts are not shown to venue staff, as promised to authors
    versions: {
      every: {
        NOT: [{ status: 'DRAFT' }, { status: 'INCOMPLETE' }],
      },
    },
  };

  const skip = perPage ? ((page ?? 1) - 1) * perPage : undefined;
  const take = perPage ? perPage : undefined;

  const [submissions, total] = await Promise.all([
    sites.submissions.list(ctx, [], where, skip, take),
    countSubmissions(ctx, where),
  ]);

  const items = await Promise.all(
    submissions.items.map(async (s: any) => {
      const workflow = getWorkflow(ctx.$config, [], s.collection.workflow);
      return {
        ...s,
        workflow,
        signature: createPreviewToken(
          ctx.site.name,
          s.id,
          ctx.$config.api.previewIssuer,
          ctx.$config.api.previewSigningSecret,
        ),
      };
    }),
  );

  return {
    items,
    total,
    page: perPage ? (page ?? 1) : undefined,
    perPage,
    hasMore: perPage ? (skip ?? 0) + (take ?? 0) < total : false,
  };
}

export async function dbQueryJobs(ctx: SiteContext) {
  return jobs.list(
    ctx,
    ctx.site.id,
    [KnownJobTypes.PUBLISH, KnownJobTypes.UNPUBLISH],
    [$Enums.JobStatus.RUNNING],
  );
}
