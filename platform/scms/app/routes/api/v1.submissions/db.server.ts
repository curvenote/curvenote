import { error404, type ClientExtension } from '@curvenote/scms-core';
import type { SubmissionCatalogListingDTO } from '@curvenote/common';
import {
  dbListLatestPublishedSubmissions,
  fetchWorkVersionSubjects,
  type Context,
} from '@curvenote/scms-server';
import { formatSubmissionCatalogListing } from './format.server';
import { resolvePublicCatalogSites, type PublicCatalogSite } from './public-sites.server';

/** List published submissions across public catalog sites (`GET /v1/submissions`). */
export async function listSubmissionCatalog(
  ctx: Context,
  extensions: ClientExtension[],
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
  opts?: { page?: number; limit?: number; sort?: 'published_desc' | 'published_asc' },
): Promise<SubmissionCatalogListingDTO> {
  const publicSites = await resolvePublicCatalogSites(where?.site);
  const sitesById = new Map<string, PublicCatalogSite>(publicSites.map((s) => [s.id, s]));
  const siteIds = publicSites.map((s) => s.id);

  const dbo = await dbListLatestPublishedSubmissions(siteIds, extensions, ctx.$config, where, opts);
  if (!dbo) throw error404();

  const subjects = await fetchWorkVersionSubjects(dbo.items.map((row) => row.work_version.id));
  return formatSubmissionCatalogListing(ctx, dbo, sitesById, where, { ...opts, subjects });
}
