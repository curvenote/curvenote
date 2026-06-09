import type {
  CatalogSiteSummaryDTO,
  DoiResolvedSubmissionDTO,
  SubmissionCatalogItemDTO,
  SubmissionCatalogListingDTO,
} from '@curvenote/common';
import { doi as doiUtil } from 'doi-utils';
import { makePaginationLinks } from '@curvenote/scms-core';
import {
  SiteContext,
  dbGetSite,
  formatPublishedSiteWorkWithVersions,
  formatSiteWorkDTO,
  getPrismaClient,
  submissionListing,
  type Context,
  type SubmissionListingDBO,
} from '@curvenote/scms-server';
import type { PublicCatalogSite } from './public-sites.server';

export function formatCatalogSiteSummary(
  ctx: Context,
  site: PublicCatalogSite,
): CatalogSiteSummaryDTO {
  return {
    name: site.name,
    title: site.title,
    links: { self: ctx.asApiUrl(`/sites/${site.name}`) },
  };
}

function formatCatalogResolveLink(
  ctx: Context,
  siteName: string,
  rawDoi: string | null | undefined,
): string | undefined {
  if (!rawDoi) return undefined;
  const normalized = doiUtil.normalize(rawDoi);
  if (!normalized) return undefined;
  return submissionListing.buildDoiApiUrl(ctx, normalized, { site: siteName });
}

export async function loadSiteContextMap(
  ctx: Context,
  siteIds: string[],
): Promise<Map<string, SiteContext>> {
  const prisma = await getPrismaClient();
  const uniqueIds = [...new Set(siteIds)];
  const sites = await prisma.site.findMany({
    where: { id: { in: uniqueIds } },
    include: {
      submissionKinds: true,
      collections: { orderBy: { date_created: 'desc' } },
      domains: true,
    },
  });
  const map = new Map<string, SiteContext>();
  for (const site of sites) {
    if (site.metadata) {
      map.set(site.id, new SiteContext(ctx, site));
    }
  }
  return map;
}

export async function formatSubmissionCatalogListing(
  ctx: Context,
  dbo: SubmissionListingDBO,
  sitesById: Map<string, PublicCatalogSite>,
  where?: {
    site?: string[];
    collection?: string;
    kind?: string;
    status?: string;
    q?: string;
    subject?: string;
    from?: string;
    to?: string;
  },
  opts?: {
    page?: number;
    limit?: number;
    sort?: 'published_desc' | 'published_asc';
    subjects?: Map<string, string>;
  },
): Promise<SubmissionCatalogListingDTO> {
  const siteCtxMap = await loadSiteContextMap(
    ctx,
    dbo.items.map((row) => row.submission.site_id),
  );

  const selfUrl = new URL(ctx.asApiUrl('/submissions'));
  for (const siteName of where?.site ?? []) {
    selfUrl.searchParams.append('site', siteName);
  }
  if (where?.collection) selfUrl.searchParams.set('collection', where.collection);
  if (where?.kind) selfUrl.searchParams.set('kind', where.kind);
  if (where?.status) selfUrl.searchParams.set('status', where.status);
  if (where?.q) selfUrl.searchParams.set('q', where.q);
  if (where?.subject) selfUrl.searchParams.set('subject', where.subject);
  if (where?.from) selfUrl.searchParams.set('from', where.from);
  if (where?.to) selfUrl.searchParams.set('to', where.to);
  // Only emit a non-default sort so default listings keep clean, cache-friendly URLs.
  if (opts?.sort && opts.sort !== 'published_desc') selfUrl.searchParams.set('sort', opts.sort);

  const links = makePaginationLinks({ self: selfUrl.toString() }, dbo.total, opts ?? {});

  const items: SubmissionCatalogItemDTO[] = dbo.items.map((row) => {
    const site = sitesById.get(row.submission.site_id);
    const siteCtx = siteCtxMap.get(row.submission.site_id);
    if (!site || !siteCtx) {
      throw new Error(`Missing catalog site context for submission ${row.submission.id}`);
    }
    const work = formatSiteWorkDTO(siteCtx, row, {
      subject: opts?.subjects?.get(row.work_version.id),
    });
    const doi = row.work_version.doi ?? row.submission.work?.doi;
    return {
      ...work,
      site: formatCatalogSiteSummary(ctx, site),
      links: {
        ...work.links,
        resolve: formatCatalogResolveLink(ctx, site.name, doi),
      },
    };
  });

  return { items, total: dbo.total, links };
}

export async function formatDoiResolvedSubmission(
  ctx: Context,
  site: PublicCatalogSite,
  dbo: Parameters<typeof formatPublishedSiteWorkWithVersions>[1],
): Promise<DoiResolvedSubmissionDTO> {
  const fullSite = await dbGetSite(site.name);
  if (!fullSite?.metadata) {
    throw new Error(`Site not found for DOI resolve: ${site.name}`);
  }
  const siteCtx = new SiteContext(ctx, fullSite);
  const published = await formatPublishedSiteWorkWithVersions(siteCtx, dbo);
  const normalizedDoi = dbo.work_version.doi ?? dbo.submission.work?.doi ?? undefined;
  const normalized = normalizedDoi ? doiUtil.normalize(normalizedDoi) : null;
  const self =
    normalized != null
      ? submissionListing.buildDoiApiUrl(ctx, normalized, { site: site.name })
      : published.links.self;

  return {
    ...published,
    site: formatCatalogSiteSummary(ctx, site),
    links: {
      ...published.links,
      self: self ?? published.links.self,
    },
  };
}
