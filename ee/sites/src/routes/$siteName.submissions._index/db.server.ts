import type { SiteContext } from '@curvenote/scms-server';
import { getPrismaClient } from '@curvenote/scms-server';
import type { Prisma } from '@curvenote/scms-db';
import { dbLoadIndexVersionDates } from './index.versions.server.js';

/**
 * Route-local data access for the new submissions index listing.
 *
 * Everything here relies on the denormalised `Submission.is_listed` flag,
 * maintained by the Postgres trigger function `submission_recompute_listing_fields`
 * (see migration `20260526120000_add_submission_is_listed`). The flag is true
 * iff the submission has at least one version and no version is in DRAFT
 * or INCOMPLETE status — i.e. it is the legacy "signed" predicate, expressed
 * as a single indexable column.
 *
 * The listing query is served by the partial index
 *   `Submission_is_listed_listing_idx (site_id, date_published DESC, date_created DESC)
 *    WHERE is_listed = TRUE`
 * so both the page and the count are direct index scans.
 *
 * This file imports nothing from `submissions-classic`.
 */

type WorkVersionMinimal = {
  title: string;
  authors: string[];
  doi: string | null;
};

export type IndexListingRow = {
  id: string;
  date_created: string;
  date_published: string | null;
  work: { doi: string | null } | null;
  kind: { id: string; name: string; content: Prisma.JsonValue };
  collection: {
    id: string;
    name: string;
    slug: string;
    open: boolean;
    content: Prisma.JsonValue;
    workflow: string;
  };
  versions: { status: string; work_version: WorkVersionMinimal }[];
  publishedVersion?: { date_created: string };
  retractedVersion?: { date_created: string };
  activity: { date_created: string }[];
};

function buildIndexListingWhere(siteId: string): Prisma.SubmissionWhereInput {
  return { site_id: siteId, is_listed: true };
}

export async function dbCountSubmissionsForIndex(ctx: SiteContext): Promise<number> {
  const prisma = await getPrismaClient();
  return prisma.submission.count({ where: buildIndexListingWhere(ctx.site.id) });
}

export async function dbListSubmissionsForIndex(
  ctx: SiteContext,
  { page, perPage }: { page: number; perPage: number },
): Promise<IndexListingRow[]> {
  const prisma = await getPrismaClient();
  const rows = await prisma.submission.findMany({
    where: buildIndexListingWhere(ctx.site.id),
    orderBy: [{ date_published: 'desc' }, { date_created: 'desc' }],
    skip: (page - 1) * perPage,
    take: perPage,
    select: {
      id: true,
      date_created: true,
      date_published: true,
      work: { select: { doi: true } },
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
      versions: {
        take: 1,
        orderBy: { date_created: 'desc' },
        select: {
          status: true,
          work_version: { select: { title: true, authors: true, doi: true } },
        },
      },
      activity: {
        take: 1,
        orderBy: { date_created: 'desc' },
        select: { date_created: true },
      },
    },
  });

  const versionDates = await dbLoadIndexVersionDates(rows.map((row) => row.id));

  return rows.map((row) => {
    const dates = versionDates.get(row.id);
    return {
      ...row,
      publishedVersion: dates?.publishedVersion,
      retractedVersion: dates?.retractedVersion,
    };
  });
}
