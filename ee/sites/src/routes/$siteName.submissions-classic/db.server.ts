import type { SiteContext } from '@curvenote/scms-server';
import { createPreviewToken, getPrismaClient, jobs } from '@curvenote/scms-server';
import type { Prisma } from '@curvenote/scms-db';
import { JobStatus } from '@curvenote/scms-db';
import { getWorkflow, KnownJobTypes } from '@curvenote/scms-core';
import { pickListingActiveVersionId } from './listing.utils.server.js';
import { dbLoadListingVersionSnapshots } from './listing.versions.server.js';
import {
  formatSubmissionListingItem,
  type ActiveVersionWork,
  type ListingSubmissionRow,
} from './listing.format.server.js';
import type { AugmentedSubmissionListingItem, SubmissionListingPage } from './types.js';

// TODO(perf): Replace versions.every draft/incomplete filter with denormalized flag or SQL EXISTS tuned to indexes.
// TODO(perf): Add DB indexes — Submission.site_id, SubmissionVersion.submission_id, listing sort columns.
// TODO(perf): Use keyset (cursor) pagination instead of OFFSET for deep infinite scroll.
// TODO(perf): Load running publish/unpublish jobs once per page instead of on every scroll action.
// TODO(perf): Denormalize last_activity on Submission to drop per-row activity join.

function buildListingWhere(
  siteId: string,
  moreWhere?: Prisma.SubmissionWhereInput,
): Prisma.SubmissionWhereInput {
  return {
    AND: [
      { site_id: siteId },
      moreWhere ?? {},
      { versions: { some: {} } },
      {
        NOT: {
          versions: {
            every: { status: 'DRAFT' },
          },
        },
      },
      {
        versions: {
          every: {
            NOT: [{ status: 'DRAFT' }, { status: 'INCOMPLETE' }],
          },
        },
      },
    ],
  };
}

async function dbListSubmissionRows(
  siteId: string,
  where: Prisma.SubmissionWhereInput,
  skip?: number,
  take?: number,
): Promise<ListingSubmissionRow[]> {
  const prisma = await getPrismaClient();
  const rows = await prisma.submission.findMany({
    where: buildListingWhere(siteId, where),
    skip,
    take,
    select: {
      id: true,
      date_created: true,
      date_published: true,
      submitted_by: { select: { id: true, display_name: true } },
      kind: { select: { id: true, name: true, content: true } },
      collection: {
        select: {
          id: true,
          name: true,
          slug: true,
          open: true,
          content: true,
          workflow: true,
        },
      },
      slugs: { select: { slug: true, primary: true } },
      work: { select: { doi: true } },
      _count: { select: { versions: true } },
      activity: {
        take: 1,
        orderBy: { date_created: 'desc' },
        select: {
          date_created: true,
          activity_by: { select: { id: true, display_name: true } },
        },
      },
    },
    orderBy: [{ date_published: 'desc' }, { date_created: 'desc' }],
  });

  const versionSnapshots = await dbLoadListingVersionSnapshots(rows.map((row) => row.id));

  return rows.map((row) => ({
    ...row,
    versions: versionSnapshots.get(row.id) ?? [],
  }));
}

async function dbLoadActiveVersionWork(
  versionIds: string[],
): Promise<Map<string, ActiveVersionWork>> {
  if (versionIds.length === 0) {
    return new Map();
  }
  const prisma = await getPrismaClient();
  const versions = await prisma.submissionVersion.findMany({
    where: { id: { in: versionIds } },
    select: {
      id: true,
      work_version: {
        select: {
          id: true,
          work_id: true,
          title: true,
          description: true,
          authors: true,
          date: true,
          doi: true,
          work: { select: { doi: true } },
        },
      },
    },
  });
  return new Map(versions.map((v) => [v.id, v.work_version]));
}

function activeVersionIdForRow(row: ListingSubmissionRow): string | undefined {
  if (row.versions.length === 0) return undefined;
  const newest = row.versions[0];
  const published = row.versions.find((v) => v.status === 'PUBLISHED');
  return pickListingActiveVersionId(newest, published);
}

async function dbBuildAugmentedListingItems(
  ctx: SiteContext,
  rows: ListingSubmissionRow[],
): Promise<AugmentedSubmissionListingItem[]> {
  const activeVersionIds = rows
    .map(activeVersionIdForRow)
    .filter((id): id is string => id !== undefined);
  const workByVersionId = await dbLoadActiveVersionWork(activeVersionIds);

  return rows
    .map((row) => {
      const activeId = activeVersionIdForRow(row);
      const activeWork = activeId ? workByVersionId.get(activeId) : undefined;
      const item = formatSubmissionListingItem(ctx, row, activeWork);
      if (!item) return null;
      const workflow = getWorkflow(ctx.$config, [], row.collection.workflow);
      return {
        ...item,
        workflow,
        signature: createPreviewToken(
          ctx.site.name,
          row.id,
          ctx.$config.api.previewIssuer,
          ctx.$config.api.previewSigningSecret,
        ),
      };
    })
    .filter((item): item is AugmentedSubmissionListingItem => item !== null);
}

/**
 * Site app submissions listing — optimized Prisma access local to this route (not API loaders).
 */
export async function dbCountSignedSubmissions(
  ctx: SiteContext,
  moreWhere?: Prisma.SubmissionWhereInput,
): Promise<number> {
  const prisma = await getPrismaClient();
  return prisma.submission.count({
    where: buildListingWhere(ctx.site.id, moreWhere ?? {}),
  });
}

/**
 * Site app submissions listing — optimized Prisma access local to this route (not API loaders).
 */
export async function dbListSignedSubmissions(
  ctx: SiteContext,
  moreWhere?: Prisma.SubmissionWhereInput,
  page?: number,
  perPage?: number,
): Promise<SubmissionListingPage> {
  const skip = perPage ? ((page ?? 1) - 1) * perPage : undefined;
  const take = perPage ? perPage : undefined;

  const rows = await dbListSubmissionRows(ctx.site.id, moreWhere ?? {}, skip, take);
  const items = await dbBuildAugmentedListingItems(ctx, rows);

  return {
    items,
    page: perPage ? (page ?? 1) : undefined,
    perPage,
    hasMore: perPage ? items.length === perPage : false,
  };
}

export async function dbQueryJobs(ctx: SiteContext) {
  return jobs.list(
    ctx,
    ctx.site.id,
    [KnownJobTypes.PUBLISH, KnownJobTypes.UNPUBLISH],
    [JobStatus.RUNNING],
  );
}
