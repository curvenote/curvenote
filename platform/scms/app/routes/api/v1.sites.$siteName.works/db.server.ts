import {
  getPrismaClient,
  submissionVersionForSiteWorkSelect,
  type SiteContext,
} from '@curvenote/scms-server';
import {
  error404,
  httpError,
  isOffsetPaginationRequested,
  getWorkflows,
  registerExtensionWorkflows,
  type ClientExtension,
} from '@curvenote/scms-core';
import type { Prisma } from '@curvenote/scms-db';
import { formatSiteWorkDTOFromSubmissions, type ListDBO } from './format.server';

/**
 * NOTE we can not just count() here because of the distinct field.
 * Writing a raw query would be an option but that is complex for this query,
 * especially with multiple parameters and ensuring safety from sql injection,
 * so this is a workaround that should be replaced if performance is an issue.
 *
 * (Co-located here so the count strategy can be optimized alongside the page query.)
 */
async function dbCountSubmissions(
  siteName: string,
  collectionName: string | undefined,
  status: string,
  kind?: string,
  tx?: Prisma.TransactionClient,
) {
  const prisma = await getPrismaClient();
  const records = await (tx ?? prisma).submissionVersion.findMany({
    where: {
      submission: {
        site: { is: { name: siteName } },
        collection: {
          name: collectionName,
        },
        kind: {
          name: kind,
        },
      },
      status,
    },
    select: {
      id: true,
    },
    distinct: ['submission_id'],
  });

  return records.length;
}

async function dbQuerySubmissions(
  siteName: string,
  collectionName: string | undefined,
  status: string,
  kind?: string,
  opts?: { page?: number; limit?: number },
  tx?: Prisma.TransactionClient,
) {
  const skip = opts?.limit ? (opts?.page ?? 0) * opts?.limit : undefined;
  const take = opts?.limit;
  const prisma = await getPrismaClient();
  return (tx ?? prisma).submissionVersion.findMany({
    skip,
    take,
    where: {
      submission: {
        site: { is: { name: siteName } },
        collection: { name: collectionName },
        kind: {
          name: kind,
        },
      },
      status,
    },
    select: submissionVersionForSiteWorkSelect,
    orderBy: [
      {
        submission: {
          date_published: 'desc',
        },
      },
      {
        submission: {
          date_created: 'desc',
        },
      },
      {
        date_created: 'desc',
      },
    ],
    distinct: ['submission_id'],
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
      dbQuerySubmissions(ctx.site.name, collectionName, status, where?.kind, opts),
      dbCountSubmissions(ctx.site.name, collectionName, status, where?.kind),
    ]);
    return { items, total };
  }

  // no pagination if limit and page are not provided
  // we can still limit, but in this branch we avoid
  // the extra count query
  if (opts?.page === undefined) {
    const items = await dbQuerySubmissions(
      ctx.site.name,
      collectionName,
      status,
      where?.kind,
      opts,
    );
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
