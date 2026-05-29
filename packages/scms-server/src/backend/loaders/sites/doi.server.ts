import { doi } from 'doi-utils';
import { getPrismaClient } from '../../prisma.server.js';
import { error404 } from '@curvenote/scms-core';
import { formatDate, pickVersionTag } from '@curvenote/common';
import type { SiteWorkVersionDTO } from '@curvenote/common';
import { formatSiteWorkDTO } from './submissions/published/get.server.js';
import type { ModifiedSiteWorkDTO } from './submissions/published/get.server.js';
import type { SiteContext } from '../../context.site.server.js';
import {
  siteWorkWorkVersionSelect,
  submissionVersionForSiteWorkSelect,
} from '../../prisma.selects.server.js';

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
    select: {
      ...siteWorkWorkVersionSelect,
      work: { select: { id: true, doi: true, key: true } },
      submissionVersions: {
        where: {
          status: 'PUBLISHED',
        },
        orderBy: {
          date_created: 'desc',
        },
        take: 1,
        select: submissionVersionForSiteWorkSelect,
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
    select: submissionVersionForSiteWorkSelect,
  });
}

/**
 * All *published* submission versions for a submission, newest first. Used to build the
 * `versions` summary array so clients can render version navigation from the DOI response
 * without a second request to `links.versions`.
 */
async function dbGetPublishedVersionsForSubmission(siteName: string, submissionId: string) {
  const prisma = await getPrismaClient();
  return prisma.submissionVersion.findMany({
    where: {
      status: 'PUBLISHED',
      submission: { id: submissionId, site: { name: siteName } },
    },
    orderBy: { date_created: 'desc' },
    select: {
      id: true,
      tags: true,
      date_published: true,
      date_created: true,
    },
  });
}

type PublishedVersionsDBO = Awaited<ReturnType<typeof dbGetPublishedVersionsForSubmission>>;

function formatSiteWorkVersions(rows: PublishedVersionsDBO): SiteWorkVersionDTO[] {
  return rows.map((row) => ({
    submission_version_id: row.id,
    version: pickVersionTag(row.tags) ?? undefined,
    date: row.date_published ?? formatDate(row.date_created),
    tags: [...row.tags],
  }));
}

export default async function (
  ctx: SiteContext,
  maybeDoi: string,
  opts?: SiteDoiResolveOptions,
): Promise<ModifiedSiteWorkDTO & { versions: SiteWorkVersionDTO[] }> {
  if (!ctx.site) throw error404('Not Found - No site found');

  const doiNormalized = doi.normalize(maybeDoi);
  if (!doiNormalized) throw error404('Not Found - Invalid DOI');

  const tag = opts?.tag?.trim();
  let siteWork: ModifiedSiteWorkDTO;
  if (tag) {
    const sv = await dbGetPublishedSubmissionVersionByDoiAndTag(ctx.site.name, doiNormalized, tag);
    if (!sv) {
      throw error404(
        'Not Found - No published submission version with that tag for this DOI on this site',
      );
    }
    siteWork = formatSiteWorkDTO(ctx, { ...sv, work_version: sv.work_version });
  } else {
    const dbo = await dbGetLatestPublishedWorkByDoi(doiNormalized);
    if (!dbo || dbo.length === 0)
      throw error404('Not Found - No work with that DOI exists in database');

    const { submissionVersions, ...work_version } = dbo[0];
    const sv = submissionVersions[0];
    siteWork = formatSiteWorkDTO(ctx, { ...sv, work_version });
  }

  // One indexed query for the work's published versions, replacing a second
  // client round-trip to the submission `versions` listing.
  const versionRows = await dbGetPublishedVersionsForSubmission(
    ctx.site.name,
    siteWork.submission_id,
  );

  return { ...siteWork, versions: formatSiteWorkVersions(versionRows) };
}
