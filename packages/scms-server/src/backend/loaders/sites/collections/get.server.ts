import type { CollectionDTO } from '@curvenote/common';
import type { SiteContext } from '../../../context.site.server.js';
import { coerceToObject, error404 } from '@curvenote/scms-core';
import { getPrismaClient } from '../../../prisma.server.js';
import { type Prisma } from '@prisma/client';

async function dbGetCollection(ctx: SiteContext, where: Prisma.CollectionWhereInput) {
  const prisma = await getPrismaClient();
  return prisma.collection.findFirst({
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

export type DBO = Exclude<Prisma.PromiseReturnType<typeof dbGetCollection>, null>;

export function formatCollectionDTO(ctx: SiteContext, dbo: DBO): CollectionDTO {
  const content = coerceToObject(dbo.content);
  return {
    id: dbo.id,
    name: dbo.name,
    slug: dbo.slug,
    workflow: dbo.workflow,
    date_created: dbo.date_created,
    date_modified: dbo.date_modified,
    content,
    default: dbo.default,
    open: dbo.open,
    kinds: dbo.kindsInCollection.map((item) => ({
      id: item.kind.id,
      name: item.kind.name,
      content: coerceToObject(item.kind.content),
      default: item.kind.default,
      links: {
        self: ctx.asApiUrl(`/sites/${ctx.site.name}/kinds/${item.kind.id}`),
        site: ctx.asApiUrl(`/sites/${ctx.site.name}`),
      },
    })),
    num_published: dbo._count.submissions,
    parent_id: dbo.parent_id ?? undefined,
    links: {
      self: ctx.asApiUrl(`/sites/${ctx.site.name}/collections/${dbo.id}`),
      site: ctx.asApiUrl(`/sites/${ctx.site.name}`),
    },
  };
}

export default async function (ctx: SiteContext, where: Prisma.CollectionWhereInput) {
  // TODO: make collections real
  const dbo = await dbGetCollection(ctx, where);
  if (!dbo) throw error404();
  return formatCollectionDTO(ctx, dbo);
}
