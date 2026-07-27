import { doi } from 'doi-utils';
import { Prisma } from '@curvenote/scms-db';
import { getPrismaClient } from '../../prisma.server.js';
import { error404 } from '@curvenote/scms-core';
import {
  formatPublishedSiteWorkWithVersions,
  type PublishedSiteWorkDTO,
} from '../sites/submissions/published/get.server.js';
import type { Context } from '../../context.server.js';
import { SiteContext } from '../../context.site.server.js';
import { dbGetSite } from '../sites/get.server.js';
import { siteWorkDtoSelect } from '../../prisma.selects.server.js';

export type DoiResolveOptions = {
  /** If set, pick the latest *published* submission version for this DOI whose `tags` contains this string */
  tag?: string;
};

/**
 * Resolve the latest *published* submission version for a DOI **across all public sites**.
 *
 * This is the site-agnostic sibling of `fetchPublishedSubmissionVersionIdByDoi` in
 * `../sites/doi.server.ts`: it reuses the same btree-backed DOI equality CTE (migration
 * `20260529130000`) and the `SubmissionVersion` published hot-path partial index (migration
 * `20260610150000`), but drops the single-site `Submission.site_id` predicate and instead
 * joins `Site` filtered to **public, non-external** sites (`private = false AND external = false`).
 * The `Site` join is by primary key against a tiny table, so it does not change the plan root.
 *
 * When a DOI is published on more than one public site, the tie-break is the same as the
 * single-site resolver — latest published version wins (`date_created DESC LIMIT 1`). The
 * resolved site's `name` is returned alongside the submission-version id so the caller can
 * build a `SiteContext` for the *found* site.
 */
async function fetchPublishedSubmissionVersionAcrossPublicSites(
  doiNormalized: string,
  tag?: string,
): Promise<{ id: string; siteName: string } | null> {
  const prisma = await getPrismaClient();

  // Same doi → work-version id set as the single-site resolver: probe the DOI btree
  // indexes on WorkVersion.doi and Work.doi (via WorkVersion.work_id) rather than joining
  // Work → WorkVersion, so Postgres can short-circuit at the DOI index under load.
  const doiWorkVersions = Prisma.sql`
    SELECT wv.id AS work_version_id
    FROM "WorkVersion" wv
    WHERE wv.doi = ${doiNormalized}
    UNION
    SELECT wv.id
    FROM "WorkVersion" wv
    WHERE wv.work_id IN (SELECT w.id FROM "Work" w WHERE w.doi = ${doiNormalized})
  `;

  const rows = tag
    ? await prisma.$queryRaw<{ id: string; site_name: string }[]>`
        SELECT sv.id, si.name AS site_name
        FROM (${doiWorkVersions}) doi_wv
        INNER JOIN "SubmissionVersion" sv
          ON sv.work_version_id = doi_wv.work_version_id
         AND sv.status = 'PUBLISHED'
         AND sv.tags @> ARRAY[${tag}]::text[]
        INNER JOIN "Submission" s
          ON s.id = sv.submission_id
        INNER JOIN "Site" si
          ON si.id = s.site_id
         AND si.private = false
         AND si.external = false
        ORDER BY sv.date_created DESC
        LIMIT 1
      `
    : await prisma.$queryRaw<{ id: string; site_name: string }[]>`
        SELECT sv.id, si.name AS site_name
        FROM (${doiWorkVersions}) doi_wv
        INNER JOIN "SubmissionVersion" sv
          ON sv.work_version_id = doi_wv.work_version_id
         AND sv.status = 'PUBLISHED'
        INNER JOIN "Submission" s
          ON s.id = sv.submission_id
        INNER JOIN "Site" si
          ON si.id = s.site_id
         AND si.private = false
         AND si.external = false
        ORDER BY sv.date_created DESC
        LIMIT 1
      `;

  const row = rows[0];
  return row ? { id: row.id, siteName: row.site_name } : null;
}

/**
 * Resolve a DOI to a published site-work **without a known site**, searching all public
 * sites platform-wide.
 *
 * Takes a base `Context` (not a `SiteContext`) — the site is discovered from the DOI. Once
 * the resolving site is found, a `SiteContext` is built for it so the shared formatter
 * (`formatPublishedSiteWorkWithVersions`, which reads `ctx.site` for names, URLs and signing)
 * produces the same DTO shape as the site-scoped `sites.doi` resolver.
 */
export default async function (
  ctx: Context,
  maybeDoi: string,
  opts?: DoiResolveOptions,
): Promise<PublishedSiteWorkDTO> {
  const doiNormalized = doi.normalize(maybeDoi);
  if (!doiNormalized) throw error404('Not Found - Invalid DOI');

  const tag = opts?.tag?.trim();
  const match = await fetchPublishedSubmissionVersionAcrossPublicSites(doiNormalized, tag);
  if (!match) {
    throw error404(
      tag
        ? 'Not Found - No published submission version with that tag for this DOI on any public site'
        : 'Not Found - No work with that DOI exists in database',
    );
  }

  // The site load and the full submission-version row both depend only on the
  // match above and not on each other, so run them concurrently to keep the
  // resolve to two serial round-trips (the DOI match, then this pair).
  const prisma = await getPrismaClient();
  const [site, sv] = await Promise.all([
    dbGetSite(match.siteName),
    prisma.submissionVersion.findUnique({
      where: { id: match.id },
      select: siteWorkDtoSelect,
    }),
  ]);
  if (!site || !site.metadata) {
    throw error404('Not Found - No work with that DOI exists in database');
  }
  if (!sv) throw error404('Not Found - No work with that DOI exists in database');

  const siteCtx = new SiteContext(ctx, site);
  return formatPublishedSiteWorkWithVersions(siteCtx, sv);
}
