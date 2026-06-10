import { doi } from 'doi-utils';
import { Prisma } from '@curvenote/scms-db';
import { getPrismaClient } from '../../prisma.server.js';
import { error404 } from '@curvenote/scms-core';
import {
  formatPublishedSiteWorkWithVersions,
  type PublishedSiteWorkDTO,
} from './submissions/published/get.server.js';
import type { SiteContext } from '../../context.site.server.js';
import { siteWorkDtoSelect } from '../../prisma.selects.server.js';

export type SiteDoiResolveOptions = {
  /** If set, pick the latest *published* submission version for this DOI whose `tags` contains this string */
  tag?: string;
};

/**
 * Resolve the id of the latest *published* submission version for a DOI on a site.
 *
 * Starts from btree-backed DOI equality on `WorkVersion` / `Work` (migration
 * `20260529130000`), unions the matching work-version ids, then joins to
 * `SubmissionVersion` filtered by `status = PUBLISHED` and `Submission.site_id`.
 * This avoids Prisma's `OR` on nested relations, which duplicates `WorkVersion`
 * joins and roots the plan at `SubmissionVersion` so Postgres cannot short-circuit
 * at the DOI index under load.
 *
 * Optional `tag` uses the GIN index on `SubmissionVersion.tags` (`@>`).
 * Latest match uses `date_created DESC LIMIT 1`, backed by
 * `SubmissionVersion_published_work_version_date_created_idx` (migration
 * `20260610150000`).
 */
async function fetchPublishedSubmissionVersionIdByDoi(
  siteId: string,
  doiNormalized: string,
  tag?: string,
): Promise<string | null> {
  const prisma = await getPrismaClient();

  const doiWorkVersions = Prisma.sql`
    SELECT wv.id AS work_version_id
    FROM "WorkVersion" wv
    WHERE wv.doi = ${doiNormalized}
    UNION
    SELECT wv.id
    FROM "Work" w
    INNER JOIN "WorkVersion" wv ON wv.work_id = w.id
    WHERE w.doi = ${doiNormalized}
  `;

  const rows = tag
    ? await prisma.$queryRaw<{ id: string }[]>`
        SELECT sv.id
        FROM (${doiWorkVersions}) doi_wv
        INNER JOIN "SubmissionVersion" sv
          ON sv.work_version_id = doi_wv.work_version_id
         AND sv.status = 'PUBLISHED'
         AND sv.tags @> ARRAY[${tag}]::text[]
        INNER JOIN "Submission" s
          ON s.id = sv.submission_id
         AND s.site_id = ${siteId}
        ORDER BY sv.date_created DESC
        LIMIT 1
      `
    : await prisma.$queryRaw<{ id: string }[]>`
        SELECT sv.id
        FROM (${doiWorkVersions}) doi_wv
        INNER JOIN "SubmissionVersion" sv
          ON sv.work_version_id = doi_wv.work_version_id
         AND sv.status = 'PUBLISHED'
        INNER JOIN "Submission" s
          ON s.id = sv.submission_id
         AND s.site_id = ${siteId}
        ORDER BY sv.date_created DESC
        LIMIT 1
      `;

  return rows[0]?.id ?? null;
}

async function dbGetPublishedSiteWorkByDoi(siteId: string, doiNormalized: string, tag?: string) {
  const id = await fetchPublishedSubmissionVersionIdByDoi(siteId, doiNormalized, tag);
  if (!id) return null;

  const prisma = await getPrismaClient();
  return prisma.submissionVersion.findUnique({
    where: { id },
    select: siteWorkDtoSelect,
  });
}

export default async function (
  ctx: SiteContext,
  maybeDoi: string,
  opts?: SiteDoiResolveOptions,
): Promise<PublishedSiteWorkDTO> {
  if (!ctx.site) throw error404('Not Found - No site found');

  const doiNormalized = doi.normalize(maybeDoi);
  if (!doiNormalized) throw error404('Not Found - Invalid DOI');

  const tag = opts?.tag?.trim();
  const sv = await dbGetPublishedSiteWorkByDoi(ctx.site.id, doiNormalized, tag);
  if (!sv) {
    throw error404(
      tag
        ? 'Not Found - No published submission version with that tag for this DOI on this site'
        : 'Not Found - No work with that DOI exists in database',
    );
  }
  return formatPublishedSiteWorkWithVersions(ctx, sv);
}
