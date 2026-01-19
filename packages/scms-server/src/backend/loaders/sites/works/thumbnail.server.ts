import type { SiteContext } from '../../../context.site.server.js';
import {
  dbGetLatestPublishedSubmissionVersion,
  type DBO as PublishedDBO,
} from '../submissions/published/get.server.js';
import { error401, error404 } from '@curvenote/scms-core';
import { getPrismaClient } from '../../../prisma.server.js';
import * as cdnlib from '@curvenote/cdn';

async function dbGetLatestSubmissionVersion(siteName: string, workIdOrSlug: string) {
  const prisma = await getPrismaClient();
  return prisma.submissionVersion.findFirst({
    where: {
      submission: {
        site: {
          name: siteName,
        },
      },
      OR: [
        {
          work_version: {
            work_id: workIdOrSlug,
          },
        },
        {
          submission: {
            slugs: {
              some: {
                slug: workIdOrSlug,
              },
            },
          },
        },
      ],
    },
    orderBy: {
      date_created: 'desc',
    },
    include: {
      work_version: true,
    },
  });
}

type DBO = Exclude<Awaited<ReturnType<typeof dbGetLatestSubmissionVersion>>, null>;

export default async function loadSiteWorkThumbnail(
  ctx: SiteContext,
  workIdOrSlug: string,
  query?: string,
) {
  // TODO get a specific work version when versionId is provided
  let dbo: DBO | PublishedDBO | null = await dbGetLatestPublishedSubmissionVersion(
    ctx.site.name,
    workIdOrSlug,
  );
  if (!dbo) {
    // there is no published version of this work
    // if the user is authorized, or we have a preview signature - then we can show them the thumbnail
    if (ctx.authorized.preview || ctx.authorized.user) {
      dbo = await dbGetLatestSubmissionVersion(ctx.site.name, workIdOrSlug);
    } else {
      console.log(
        'loadWorkThumbnail - not authorized to get the thumbnail for non published work',
        ctx.authorized,
      );
    }
    if (!dbo) {
      console.warn('No work found', ctx.site.name, workIdOrSlug, { query: !!query });
      throw error404('Thumbnail - no work found');
    }
  }
  if (!dbo.work_version.cdn || !dbo.work_version.cdn_key) return;
  if (ctx.site.private && !ctx.privateCdnUrls().has(dbo.work_version.cdn)) {
    console.error(
      'Private site, but public work - possible db issue, not serving thumbnail',
      ctx.site.name,
      workIdOrSlug,
    );
    throw error401('Thumbnail - private, not allowed');
  }
  const { cdn, cdn_key } = dbo.work_version;
  const location = await cdnlib.getCdnLocation({ cdn, key: cdn_key });

  const thumbnail = await cdnlib.getThumbnailBuffer({
    ...location,
    query,
  });

  return thumbnail;
}
