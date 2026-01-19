import { getPrismaClient } from '../../../../prisma.server.js';
import type { SiteContext } from '../../../../context.site.server.js';
import type { SiteWorkListingDTO } from '@curvenote/common';
import type { ClientExtension } from '@curvenote/scms-core';
import {
  error404,
  httpError,
  makePaginationLinks,
  getWorkflows,
  registerExtensionWorkflows,
} from '@curvenote/scms-core';
import type { Prisma } from '@curvenote/scms-db';
import type { ModifiedSiteWorkDTO } from './get.server.js';
import { formatSiteWorkDTO } from './get.server.js';

/** NOTE we can not just count() here because of the distinct field
// writing a raw query would be an option but that is complex for this query
// especially with multiple parameters and ensuring safety from sql injection
// to this is a workaround that should be replaced if performance is an issue
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
    include: {
      submission: {
        include: {
          kind: true,
          collection: true,
          submitted_by: true,
          slugs: true,
          work: true,
        },
      },
      submitted_by: true,
      work_version: true,
    },
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
) {
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

  // if we have both limit and page, pagination has been requested
  if (opts?.limit && opts?.page) {
    const prisma = await getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const items = await dbQuerySubmissions(
        ctx.site.name,
        collectionName,
        status,
        where?.kind,
        opts,
        tx,
      );
      const total = await dbCountSubmissions(
        ctx.site.name,
        collectionName,
        status,
        where?.kind,
        tx,
      );
      return { items, total };
    });
  }

  // no pagination if limit and page are not provided
  // we can still limit, but in this branch we avoid
  // the extra count query
  if (!opts?.page) {
    const items = await dbQuerySubmissions(
      ctx.site.name,
      collectionName,
      status,
      where?.kind,
      opts,
    );
    return { items, total: items.length };
  }
}

export type DBO = NonNullable<
  Exclude<Awaited<ReturnType<typeof dbListLatestPublishedSubmissions>>, null>
>;

export function formatSiteWorkDTOFromSubmissions(
  ctx: SiteContext,
  dbo: DBO,
  where?: { collection?: string; kind?: string; status?: string },
  opts?: { page?: number; limit?: number },
): Omit<SiteWorkListingDTO, 'items'> & { items: ModifiedSiteWorkDTO[] } {
  const selfUrl = new URL(ctx.asApiUrl(`/sites/${ctx.site.name}/works`));
  if (where?.collection) selfUrl.searchParams.set('collection', where?.collection ?? '');
  if (where?.kind) selfUrl.searchParams.set('kind', where?.kind ?? '');
  if (where?.status) selfUrl.searchParams.set('status', where?.status ?? '');

  const links = makePaginationLinks(
    {
      self: selfUrl.toString(),
      site: ctx.asApiUrl(`/sites/${ctx.site.name}`),
    },
    dbo.total,
    opts ?? {},
  );

  return {
    items: dbo.items.map((v: DBO['items'][0]) => {
      // note: we know there is at least one version
      return formatSiteWorkDTO(ctx, v);
    }),
    total: dbo.total,
    links,
  };
}

export default async function (
  ctx: SiteContext,
  extensions: ClientExtension[],
  where?: { collection?: string; kind?: string; status?: string },
  opts?: { page?: number; limit?: number },
) {
  const dbo = await dbListLatestPublishedSubmissions(ctx, extensions, where, opts);
  if (!dbo) throw error404();
  return formatSiteWorkDTOFromSubmissions(ctx, dbo, where, opts);
}
