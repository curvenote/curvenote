import { doi } from 'doi-utils';
import { getPrismaClient } from '../../prisma.server.js';
import { error404 } from '@curvenote/scms-core';
import { formatSiteWorkDTO } from './submissions/published/get.server.js';
import type { SiteContext } from '../../context.site.server.js';

export type SiteDoiResolveOptions = {
  /** If set, pick the latest *published* submission version for this DOI whose `tags` contains this string */
  tag?: string;
};

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

async function dbGetPublishedSubmissionVersionByDoiAndTag(
  siteName: string,
  doiNormalized: string,
  tag: string,
) {
  const prisma = await getPrismaClient();
  return prisma.submissionVersion.findFirst({
    where: {
      status: 'PUBLISHED',
      tags: { has: tag },
      submission: { site: { name: siteName } },
      OR: [
        { work_version: { doi: doiNormalized } },
        { work_version: { work: { doi: doiNormalized } } },
      ],
    },
    orderBy: { date_created: 'desc' },
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
      work_version: true,
    },
  });
}

export default async function (ctx: SiteContext, maybeDoi: string, opts?: SiteDoiResolveOptions) {
  if (!ctx.site) throw error404('Not Found - No site found');

  const doiNormalized = doi.normalize(maybeDoi);
  if (!doiNormalized) throw error404('Not Found - Invalid DOI');

  const tag = opts?.tag?.trim();
  if (tag) {
    const sv = await dbGetPublishedSubmissionVersionByDoiAndTag(ctx.site.name, doiNormalized, tag);
    if (!sv) {
      throw error404(
        'Not Found - No published submission version with that tag for this DOI on this site',
      );
    }
    return formatSiteWorkDTO(ctx, { ...sv, work_version: sv.work_version });
  }

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
