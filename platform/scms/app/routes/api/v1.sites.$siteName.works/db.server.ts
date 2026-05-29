import { getPrismaClient, type SiteContext } from '@curvenote/scms-server';
import {
  error404,
  httpError,
  isOffsetPaginationRequested,
  getWorkflows,
  registerExtensionWorkflows,
  type ClientExtension,
} from '@curvenote/scms-core';
import type { Prisma } from '@curvenote/scms-db';
import { formatSiteWorkDTOFromSubmissions, siteWorkListingSelect } from './format.server';
import type { ListDBO, RowDBO } from './format.server';

/**
 * Splits the co-located narrow site-work select into the parts needed when the
 * query is rooted at `Submission`:
 *  - `submission` relations + scalars (kind, collection, slugs, work, …)
 *  - the SubmissionVersion fields, minus the nested `submission` (which we
 *    re-attach from the outer query).
 */
function getListingSelects() {
  const { submission, ...submissionVersionSelect } = siteWorkListingSelect;
  return { submissionInnerSelect: submission.select, submissionVersionSelect };
}

/**
 * Shared filter for the listing: submissions on this site (optionally scoped to
 * a collection / kind) that have at least one version in the requested status.
 * Mirrors the previous `submissionVersion.status` + `distinct` semantics.
 *
 * Filters on `site_id` directly (the caller already resolved the site) rather
 * than joining `Site` by name, so the planner can use the
 * `(site_id, date_published DESC, date_created DESC)` index for both the
 * ordered page scan and the COUNT.
 */
function buildListingWhere(
  siteId: string,
  collectionName: string | undefined,
  status: string,
  kind: string | undefined,
): Prisma.SubmissionWhereInput {
  return {
    site_id: siteId,
    collection: { name: collectionName },
    kind: { name: kind },
    versions: { some: { status } },
  };
}

/**
 * Count submissions that have at least one version in the requested status.
 *
 * Rooted at `Submission` (already one row per listing entry) so this is a
 * single SQL COUNT over a semijoin — no longer materialising every matching
 * version id into Node just to read `.length`.
 */
async function dbCountSubmissions(
  siteId: string,
  collectionName: string | undefined,
  status: string,
  kind?: string,
  tx?: Prisma.TransactionClient,
) {
  const prisma = await getPrismaClient();
  return (tx ?? prisma).submission.count({
    where: buildListingWhere(siteId, collectionName, status, kind),
  });
}

/**
 * List submissions (the latest version in the requested status per submission),
 * ordered by publication date.
 *
 * Rooted at `Submission` rather than `SubmissionVersion`, so there is no
 * `distinct` step: the table already has one row per listing entry, which lets
 * Postgres push LIMIT/OFFSET into an index range scan instead of sorting the
 * full matching set in memory. The latest matching version is pulled via a
 * constrained `take: 1` relation and re-shaped into the RowDBO the formatter
 * expects, so the delivered payload is unchanged.
 */
async function dbQuerySubmissions(
  siteId: string,
  collectionName: string | undefined,
  status: string,
  kind?: string,
  opts?: { page?: number; limit?: number },
  tx?: Prisma.TransactionClient,
): Promise<RowDBO[]> {
  const skip = opts?.limit ? (opts?.page ?? 0) * opts?.limit : undefined;
  const take = opts?.limit;
  const { submissionInnerSelect, submissionVersionSelect } = getListingSelects();
  const prisma = await getPrismaClient();
  const submissions = await (tx ?? prisma).submission.findMany({
    skip,
    take,
    where: buildListingWhere(siteId, collectionName, status, kind),
    orderBy: [{ date_published: 'desc' }, { date_created: 'desc' }],
    select: {
      ...submissionInnerSelect,
      versions: {
        where: { status },
        orderBy: [{ date_created: 'desc' }],
        take: 1,
        select: submissionVersionSelect,
      },
    },
  });

  return submissions
    .filter((s) => s.versions.length > 0)
    .map((s) => {
      const { versions, ...submission } = s;
      return { ...versions[0], submission } as RowDBO;
    });
}

export async function dbListLatestPublishedSubmissions(
  ctx: SiteContext,
  extensions: ClientExtension[],
  where?: { collection?: string; kind?: string; status?: string },
  opts?: { page?: number; limit?: number },
): Promise<ListDBO | undefined> {
  // only allow lookup on status if collection is also provided
  // and limit to allowed statuses for now
  const status: string = where?.status === 'in-review' ? 'IN_REVIEW' : 'PUBLISHED';
  if (status !== 'PUBLISHED' && !where?.collection) {
    throw httpError(
      400,
      'Can only filter by a status other than "published" when also filtering by collection',
    );
  }

  const workflows = getWorkflows(ctx.$config, registerExtensionWorkflows(extensions));
  let collectionName: string | undefined;
  if (where?.collection) {
    // when filtering on collection, we need to first check if the workflow
    // on the collection is visible for the state[status] being queried
    const prisma = await getPrismaClient();
    const collection = await prisma.collection.findFirst({
      where: {
        name: where.collection,
        site: { name: ctx.site.name },
      },
    });

    if (!collection) {
      return { items: [], total: 0 };
    } else {
      const workflow = workflows[collection.workflow];
      if (workflow.states[status].visible) {
        collectionName = collection.name;
      } else {
        return { items: [], total: 0 };
      }
    }
  }

  if (isOffsetPaginationRequested(opts ?? {})) {
    const [items, total] = await Promise.all([
      dbQuerySubmissions(ctx.site.id, collectionName, status, where?.kind, opts),
      dbCountSubmissions(ctx.site.id, collectionName, status, where?.kind),
    ]);
    return { items, total };
  }

  // no pagination if limit and page are not provided
  // we can still limit, but in this branch we avoid
  // the extra count query
  if (opts?.page === undefined) {
    const items = await dbQuerySubmissions(ctx.site.id, collectionName, status, where?.kind, opts);
    return { items, total: items.length };
  }

  return undefined;
}

/**
 * List the latest published (or in-review, when scoped to a collection)
 * submission version per submission for a site, formatted as a
 * SiteWorkListingDTO.
 */
export async function listPublishedWorks(
  ctx: SiteContext,
  extensions: ClientExtension[],
  where?: { collection?: string; kind?: string; status?: string },
  opts?: { page?: number; limit?: number },
) {
  const dbo = await dbListLatestPublishedSubmissions(ctx, extensions, where, opts);
  if (!dbo) throw error404();
  return formatSiteWorkDTOFromSubmissions(ctx, dbo, where, opts);
}
