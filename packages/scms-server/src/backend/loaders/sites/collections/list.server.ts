import type { CollectionListingDTO } from '@curvenote/common';
import type { SiteContext } from '../../../context.site.server.js';
import type { ModifyUrl } from '../../types.js';
import { getPrismaClient } from '../../../prisma.server.js';
import type { Prisma } from '@curvenote/scms-db';
import { formatCollectionDTO } from './get.server.js';

async function dbListCollections(ctx: SiteContext, where: Prisma.CollectionWhereInput) {
  // External sites should not have collections
  if (ctx.site.external) {
    return [];
  }

  const prisma = await getPrismaClient();
  return prisma.collection.findMany({
    where: {
      site_id: ctx.site.id,
      ...where,
    },
    include: {
      kindsInCollection: {
        include: {
          kind: true,
        },
      },
      _count: {
        select: {
          submissions: {
            where: {
              versions: {
                some: {
                  status: {
                    notIn: ['DRAFT', 'INCOMPLETE'],
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export type DBO = Awaited<ReturnType<typeof dbListCollections>>;

export function formatCollectionListingDTO(
  ctx: SiteContext,
  dbo: DBO,
  asUrl: ModifyUrl = (s) => s,
): CollectionListingDTO {
  return {
    items: dbo.map((item) => formatCollectionDTO(ctx, item)),
    links: {
      self: asUrl(`/sites/${ctx.site.name}/collections`),
    },
  };
}

export default async function (ctx: SiteContext, where: Prisma.CollectionWhereInput) {
  const dbo = await dbListCollections(ctx, where);
  if (!dbo) throw new Error('Failed to load collections');
  return formatCollectionListingDTO(ctx, dbo);
}
