import { doi } from 'doi-utils';
import { getPrismaClient } from '../../prisma.server.js';
import { error404 } from '@curvenote/scms-core';
import { formatSiteWorkDTO } from './submissions/published/get.server.js';
import type { SiteContext } from '../../context.site.server.js';

async function dbGetLatestPublishedWorkByDoi(doiNormalized: string) {
  const prisma = await getPrismaClient();
  return await prisma.workVersion.findMany({
    where: {
      OR: [{ doi: doiNormalized }, { work: { doi: doiNormalized } }],
      submissionVersions: {
        some: {
          status: 'PUBLISHED',
        },
      },
    },
    orderBy: {
      date_created: 'desc',
    },
    take: 1,
    include: {
      work: true,
      submissionVersions: {
        where: {
          status: 'PUBLISHED',
        },
        orderBy: {
          date_created: 'desc',
        },
        take: 1,
        include: {
          submitted_by: true,
          submission: {
            include: {
              site: true,
              kind: true,
              collection: true,
              slugs: true,
              work: true,
            },
          },
        },
      },
    },
  });
}

export default async function (ctx: SiteContext, maybeDoi: string) {
  if (!ctx.site) throw error404('Not Found - No site found');

  const doiNormalized = doi.normalize(maybeDoi);
  if (!doiNormalized) throw error404('Not Found - Invalid DOI');

  const dbo = await dbGetLatestPublishedWorkByDoi(doiNormalized);
  if (!dbo || dbo.length === 0)
    throw error404('Not Found - No work with that DOI exists in database');

  const { submissionVersions, ...work_version } = dbo[0];
  const sv = submissionVersions[0];
  const reshaped = {
    ...sv,
    work_version,
  };

  return formatSiteWorkDTO(ctx, reshaped);
}
