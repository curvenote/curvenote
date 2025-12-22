import { uuidv7 as uuid } from 'uuidv7';
import { formatDate } from '@curvenote/common';
import { getPrismaClient } from '../../prisma.server.js';
import { ActivityType } from '@prisma/client';
import type { SiteContext } from '../../context.site.server.js';
import { error401, error404 } from '@curvenote/scms-core';
import { formatSiteWithContentDTO } from './get.server.js';

export async function dbUpdateSiteContent(userId: string, name: string, content: string) {
  const prisma = await getPrismaClient();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.site.update({
      where: { name },
      data: {
        date_modified: formatDate(),
        content: {
          connect: {
            id: content,
          },
        },
      },
      include: {
        content: {
          include: {
            versions: {
              take: 1,
              orderBy: { date_created: 'desc' },
            },
          },
        },
      },
    });

    const timestamp = new Date().toISOString();
    await tx.activity.create({
      data: {
        id: uuid(),
        date_created: timestamp,
        date_modified: timestamp,
        activity_by: {
          connect: {
            id: userId,
          },
        },
        work: {
          connect: {
            id: content,
          },
        },
        site: {
          connect: {
            id: updated.id,
          },
        },
        activity_type: ActivityType.SITE_CONTENT_UPDATED,
      },
    });
    return updated.content?.versions[0];
  });
}

export default async function (ctx: SiteContext, content: string) {
  if (!ctx.user) throw error401();
  const version = await dbUpdateSiteContent(ctx.user.id, ctx.site.name, content);
  if (!version) throw error404();
  return formatSiteWithContentDTO(ctx, ctx.site, version);
}
