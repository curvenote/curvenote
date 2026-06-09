import { doi } from 'doi-utils';
import { error404 } from '@curvenote/scms-core';
import type { DoiResolvedSubmissionDTO } from '@curvenote/common';
import type { Prisma } from '@curvenote/scms-db';
import { getPrismaClient, siteWorkDtoSelect, type Context } from '@curvenote/scms-server';
import {
  resolvePublicCatalogSiteByName,
  resolvePublicCatalogSites,
  type PublicCatalogSite,
} from '../v1.submissions/public-sites.server';
import { formatDoiResolvedSubmission } from '../v1.submissions/format.server';

export type CatalogDoiResolveOptions = {
  /** Scope resolution to this public catalog site. */
  siteName?: string;
  /** If set, pick the latest *published* submission version for this DOI whose `tags` contains this string */
  tag?: string;
};

/**
 * Filter for the latest *published* submission version of a DOI on the
 * requested site(s).
 *
 * Rooting at `SubmissionVersion` (rather than `WorkVersion`) makes the tag and
 * no-tag paths a single query and lets the `date_created DESC` + LIMIT 1
 * short-circuit at the first match. The DOI is matched against either the
 * version's own `doi` or the parent work's `doi` — both now backed by btree
 * indexes (migration `20260529130000`) so the equality lookup no longer
 * sequential-scans.
 *
 * Site-scoped resolution always filters to the caller's site. The global
 * catalog path scopes to public sites and applies a cross-site ordering when
 * `siteName` is omitted.
 */
function buildPublishedByDoiWhere(
  siteIds: string[],
  doiNormalized: string,
  tag?: string,
): Prisma.SubmissionVersionWhereInput {
  return {
    status: 'PUBLISHED',
    submission: {
      site_id: siteIds.length === 1 ? siteIds[0] : { in: siteIds },
    },
    ...(tag ? { tags: { has: tag } } : {}),
    OR: [
      { work_version: { doi: doiNormalized } },
      { work_version: { work: { doi: doiNormalized } } },
    ],
  };
}

/** Cross-site deterministic pick when `siteName` is omitted on `/v1/doi`. */
const GLOBAL_DOI_ORDER_BY: Prisma.SubmissionVersionOrderByWithRelationInput[] = [
  { submission: { date_published: 'desc' } },
  { submission: { date_created: 'desc' } },
  { submission: { site: { name: 'asc' } } },
  { submission: { id: 'asc' } },
  { date_created: 'desc' },
];

const SITE_DOI_ORDER_BY: Prisma.SubmissionVersionOrderByWithRelationInput[] = [
  { date_created: 'desc' },
];

async function dbGetPublishedSubmissionVersionByDoi(
  siteIds: string[],
  doiNormalized: string,
  tag: string | undefined,
  globalPick: boolean,
) {
  const prisma = await getPrismaClient();
  return prisma.submissionVersion.findFirst({
    where: buildPublishedByDoiWhere(siteIds, doiNormalized, tag),
    orderBy: globalPick ? GLOBAL_DOI_ORDER_BY : SITE_DOI_ORDER_BY,
    select: siteWorkDtoSelect,
  });
}

async function resolveCatalogSitesForDoi(
  opts?: CatalogDoiResolveOptions,
): Promise<PublicCatalogSite[]> {
  if (opts?.siteName) {
    return [await resolvePublicCatalogSiteByName(opts.siteName)];
  }
  return resolvePublicCatalogSites();
}

/** Resolve a DOI across the public submission catalog (`GET /v1/doi/...`). */
export async function resolveGlobalCatalogDoi(
  ctx: Context,
  maybeDoi: string,
  opts?: CatalogDoiResolveOptions,
): Promise<DoiResolvedSubmissionDTO> {
  const doiNormalized = doi.normalize(maybeDoi);
  if (!doiNormalized) throw error404('Not Found - Invalid DOI');

  const sites = await resolveCatalogSitesForDoi(opts);
  const siteIds = sites.map((s) => s.id);
  const tag = opts?.tag?.trim() || undefined;
  const globalPick = !opts?.siteName;

  const sv = await dbGetPublishedSubmissionVersionByDoi(siteIds, doiNormalized, tag, globalPick);
  if (!sv) {
    throw error404(
      tag
        ? 'Not Found - No published submission version with that tag for this DOI on this site'
        : 'Not Found - No work with that DOI exists in database',
    );
  }

  const site = sites.find((s) => s.id === sv.submission.site_id);
  if (!site) throw error404('Not Found - No site found');

  return formatDoiResolvedSubmission(ctx, site, sv);
}
