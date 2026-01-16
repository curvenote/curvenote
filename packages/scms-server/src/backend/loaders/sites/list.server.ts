import type { SiteListingDTO } from '@curvenote/common';
import { getPrismaClient } from '../../prisma.server.js';
import type { Prisma } from '@curvenote/scms-db';
import { dbGetSiteContent, formatSiteDTO, formatSiteWithContentDTO } from './get.server.js';
import type { Context } from '../../context.server.js';

export async function dbListMany(where?: Prisma.SiteWhereInput, include?: Prisma.SiteInclude) {
  const inc = include ?? {
    submissionKinds: true,
    collections: { orderBy: { date_created: 'desc' } },
    domains: true,
  };

  const prisma = await getPrismaClient();
  return prisma.site.findMany({
    where: {
      external: false,
      ...where,
    },
    include: inc,
  });
}

type DBO = Omit<Awaited<ReturnType<typeof dbListMany>>, 'null'>;

function formatSiteListingDTO(ctx: Context, dbo: DBO): SiteListingDTO {
  return {
    items: dbo.map((site: DBO[0]) => formatSiteDTO(ctx, site)),
    links: {
      self: ctx.asApiUrl('/sites'),
    },
  };
}

/**
 * List sites with landing content, given 'where' and 'include' queries
 *
 * This should only be used when the list is expected to be short since
 * landing content adds an extra query for each site.
 */
export async function listSitesWithContent(
  ctx: Context,
  where?: Prisma.SiteWhereInput,
  include?: Prisma.SiteInclude,
) {
  const dbo = await dbListMany(where, include);
  const items = await Promise.all(
    dbo.map(async (site: DBO[0]) => {
      const contentVersion = await dbGetSiteContent(site);
      return formatSiteWithContentDTO(ctx, site, contentVersion);
    }),
  );
  return {
    items,
    links: {
      self: ctx.asApiUrl('/sites'),
    },
  };
}

/**
 * List sites without landing content, given 'where' and 'include' queries
 */
export default async function (
  ctx: Context,
  where?: Prisma.SiteWhereInput,
  include?: Prisma.SiteInclude,
) {
  const dbo = await dbListMany(where, include);
  return formatSiteListingDTO(ctx, dbo);
}
