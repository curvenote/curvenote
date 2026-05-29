import { doi } from 'doi-utils';
import { getPrismaClient } from '../../prisma.server.js';
import { error404 } from '@curvenote/scms-core';
import { formatDate, pickVersionTag } from '@curvenote/common';
import type { SiteWorkVersionDTO } from '@curvenote/common';
import { formatSiteWorkDTO } from './submissions/published/get.server.js';
import type { ModifiedSiteWorkDTO } from './submissions/published/get.server.js';
import type { SiteContext } from '../../context.site.server.js';
import type { Prisma } from '@curvenote/scms-db';
import { siteWorkDtoSelect } from '../../prisma.selects.server.js';

export type SiteDoiResolveOptions = {
  /** If set, pick the latest *published* submission version for this DOI whose `tags` contains this string */
  tag?: string;
};

/**
 * Filter for the latest *published* submission version of a DOI on this site.
 *
 * Rooting at `SubmissionVersion` (rather than `WorkVersion`) makes the tag and
 * no-tag paths a single query and lets the `date_created DESC` + LIMIT 1
 * short-circuit at the first match. The DOI is matched against either the
 * version's own `doi` or the parent work's `doi` — both now backed by btree
 * indexes (migration `20260529130000`) so the equality lookup no longer
 * sequential-scans.
 *
 * Crucially this is always scoped to `siteName`. The previous no-tag path
 * (`WorkVersion`-rooted) omitted the site filter and could resolve a DOI that
 * was only published on a *different* site; the tag path already scoped
 * correctly, and the regression spec pins this down.
 */
function buildPublishedByDoiWhere(
  siteName: string,
  doiNormalized: string,
  tag?: string,
): Prisma.SubmissionVersionWhereInput {
  return {
    status: 'PUBLISHED',
    submission: { site: { name: siteName } },
    ...(tag ? { tags: { has: tag } } : {}),
    OR: [
      { work_version: { doi: doiNormalized } },
      { work_version: { work: { doi: doiNormalized } } },
    ],
  };
}

async function dbGetPublishedSiteWorkByDoi(siteName: string, doiNormalized: string, tag?: string) {
  const prisma = await getPrismaClient();
  return prisma.submissionVersion.findFirst({
    where: buildPublishedByDoiWhere(siteName, doiNormalized, tag),
    orderBy: { date_created: 'desc' },
    select: siteWorkDtoSelect,
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
  const sv = await dbGetPublishedSiteWorkByDoi(ctx.site.name, doiNormalized, tag);
  if (!sv) {
    throw error404(
      tag
        ? 'Not Found - No published submission version with that tag for this DOI on this site'
        : 'Not Found - No work with that DOI exists in database',
    );
  }
  const siteWork = formatSiteWorkDTO(ctx, sv);

  // One indexed query for the work's published versions, replacing a second
  // client round-trip to the submission `versions` listing.
  const versionRows = await dbGetPublishedVersionsForSubmission(
    ctx.site.name,
    siteWork.submission_id,
  );

  return { ...siteWork, versions: formatSiteWorkVersions(versionRows) };
}
