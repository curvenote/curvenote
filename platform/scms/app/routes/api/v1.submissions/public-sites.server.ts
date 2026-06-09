import { httpError } from '@curvenote/scms-core';
import { getPrismaClient } from '@curvenote/scms-server';

export type PublicCatalogSite = {
  id: string;
  name: string;
  title: string;
};

const SITE_FILTER_PARAM_NAMES = ['site', 'sites'] as const;

function collectSiteFilterValues(url: URL): string[] {
  const names: string[] = [];
  for (const param of SITE_FILTER_PARAM_NAMES) {
    for (const value of url.searchParams.getAll(param)) {
      for (const part of value.split(',')) {
        const trimmed = part.trim();
        if (trimmed) names.push(trimmed);
      }
    }
  }
  return [...new Set(names)];
}

/**
 * Parse `site` from repeated query params (`site=a&site=b`) or a single
 * comma-separated value (`site=a,b`). `sites` is accepted as an alias.
 */
export function parseSiteQueryParam(url: URL): string[] | undefined {
  const names = collectSiteFilterValues(url);
  if (names.length === 0) return undefined;
  return names;
}

/** First site name from `site` / `sites` query params (for single-site endpoints). */
export function parseSingleSiteQueryParam(url: URL): string | undefined {
  return collectSiteFilterValues(url)[0];
}

/**
 * Resolve public, non-external catalog sites. When names are provided, every
 * name must match such a site or the request is rejected.
 */
export async function resolvePublicCatalogSites(
  requestedNames?: string[],
): Promise<PublicCatalogSite[]> {
  const prisma = await getPrismaClient();
  const sites = await prisma.site.findMany({
    where: {
      private: false,
      external: false,
      ...(requestedNames?.length ? { name: { in: requestedNames } } : {}),
    },
    select: { id: true, name: true, title: true },
    orderBy: { name: 'asc' },
  });

  if (requestedNames?.length) {
    const found = new Set(sites.map((s) => s.name));
    const missing = requestedNames.filter((name) => !found.has(name));
    if (missing.length > 0) {
      throw httpError(
        400,
        `Unknown or inaccessible site(s): ${missing.join(', ')}. Only public, non-external sites are allowed.`,
      );
    }
  }

  return sites;
}

/**
 * Load a single public catalog site by name, or reject if missing / not public.
 */
export async function resolvePublicCatalogSiteByName(siteName: string): Promise<PublicCatalogSite> {
  const [site] = await resolvePublicCatalogSites([siteName]);
  if (!site) {
    throw httpError(
      400,
      `Unknown or inaccessible site: ${siteName}. Only public, non-external sites are allowed.`,
    );
  }
  return site;
}
