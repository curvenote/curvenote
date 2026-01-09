import type { SiteContext } from '../../../../context.site.server.js';
import { error401, error404 } from '@curvenote/scms-core';
import { getPrismaClient } from '../../../../prisma.server.js';
import * as cdnlib from '@curvenote/cdn';

async function dbGetWorkVersion(siteName: string, versionId: string) {
  const prisma = await getPrismaClient();
  return prisma.workVersion.findFirst({
    where: {
      id: versionId,
    },
  });
}

export default async function loadSiteWorkVersionThumbnail(
  ctx: SiteContext,
  versionId: string,
  query?: string,
) {
  const dbo = await dbGetWorkVersion(ctx.site.name, versionId);
  if (!dbo) {
    console.warn('No work version found', ctx.site.name, versionId, { query: !!query });
    throw error404('Thumbnail - no work found');
  }

  if (!dbo.cdn || !dbo.cdn_key) return;
  if (ctx.site.private && !ctx.privateCdnUrls().has(dbo.cdn)) {
    console.error(
      'Private site, but public work - possible db issue, not serving thumbnail',
      ctx.site.name,
      versionId,
    );
    throw error401('Thumbnail - private, not allowed');
  }
  const { cdn, cdn_key } = dbo;
  const location = await cdnlib.getCdnLocation({ cdn, key: cdn_key });
  const thumbnail = await cdnlib.getThumbnailBuffer({
    ...location,
    query,
  });
  return thumbnail;
}
