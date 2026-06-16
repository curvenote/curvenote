import { looksLikeUUID } from '@curvenote/scms-core';
import type { Prisma as PrismaTypes } from '@curvenote/scms-db';
import { getPrismaClient } from '../../../../prisma.server.js';
import { publishedThumbnailSelect, siteWorkDtoSelect } from '../../../../prisma.selects.server.js';

/**
 * Resolve the id of the latest *published* submission version for a work id or
 * slug on a site.
 *
 * Uses separate index-native paths (work id vs slug) instead of Prisma `OR`, and
 * scopes by `Submission.site_id` rather than joining `Site` by name. Latest match
 * uses `date_created DESC LIMIT 1`, backed by
 * `SubmissionVersion_published_work_version_date_created_idx` (work-id path) and
 * `Slug(slug, site_id)` (slug path).
 */
async function fetchPublishedSubmissionVersionIdByWorkId(
  siteId: string,
  workId: string,
): Promise<string | null> {
  const prisma = await getPrismaClient();
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT sv.id
    FROM "WorkVersion" wv
    INNER JOIN "SubmissionVersion" sv
      ON sv.work_version_id = wv.id
     AND sv.status = 'PUBLISHED'
    INNER JOIN "Submission" s
      ON s.id = sv.submission_id
     AND s.site_id = ${siteId}
    WHERE wv.work_id = ${workId}
    ORDER BY sv.date_created DESC
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

async function fetchPublishedSubmissionVersionIdBySlug(
  siteId: string,
  slug: string,
): Promise<string | null> {
  const prisma = await getPrismaClient();
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT sv.id
    FROM "Slug" slug
    INNER JOIN "Submission" s
      ON s.id = slug.submission_id
     AND s.site_id = ${siteId}
    INNER JOIN "SubmissionVersion" sv
      ON sv.submission_id = s.id
     AND sv.status = 'PUBLISHED'
    WHERE slug.slug = ${slug}
      AND slug.site_id = ${siteId}
    ORDER BY sv.date_created DESC
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

export async function fetchPublishedSubmissionVersionId(
  siteId: string,
  workIdOrSlug: string,
): Promise<string | null> {
  if (looksLikeUUID(workIdOrSlug)) {
    return fetchPublishedSubmissionVersionIdByWorkId(siteId, workIdOrSlug);
  }
  return fetchPublishedSubmissionVersionIdBySlug(siteId, workIdOrSlug);
}

export async function hydratePublishedSubmissionVersion<
  S extends PrismaTypes.SubmissionVersionSelect,
>(id: string, select: S) {
  const prisma = await getPrismaClient();
  return prisma.submissionVersion.findUnique({
    where: { id },
    select,
  });
}

export async function dbGetPublishedSiteWorkDto(siteId: string, workIdOrSlug: string) {
  const id = await fetchPublishedSubmissionVersionId(siteId, workIdOrSlug);
  if (!id) return null;
  return hydratePublishedSubmissionVersion(id, siteWorkDtoSelect);
}

export async function dbGetPublishedThumbnailRow(siteId: string, workIdOrSlug: string) {
  const id = await fetchPublishedSubmissionVersionId(siteId, workIdOrSlug);
  if (!id) return null;
  return hydratePublishedSubmissionVersion(id, publishedThumbnailSelect);
}

export type PublishedThumbnailRow = PrismaTypes.SubmissionVersionGetPayload<{
  select: typeof publishedThumbnailSelect;
}>;
