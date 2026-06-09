import {
  dbListLatestPublishedSubmissions,
  fetchWorkVersionSubjects,
  type SiteContext,
} from '@curvenote/scms-server';
import { error404, type ClientExtension } from '@curvenote/scms-core';
import { formatSiteWorkDTOFromSubmissions } from './format.server';

/** Publication-date sort direction supported by the public listing. */
export type WorksSort = 'published_desc' | 'published_asc';

/**
 * List the latest published (or in-review, when scoped to a collection)
 * submission version per submission for a site, formatted as a
 * SiteWorkListingDTO.
 */
export async function listPublishedWorks(
  ctx: SiteContext,
  extensions: ClientExtension[],
  where?: {
    collection?: string;
    kind?: string;
    status?: string;
    q?: string;
    subject?: string;
    from?: string;
    to?: string;
  },
  opts?: { page?: number; limit?: number; sort?: WorksSort },
) {
  const dbo = await dbListLatestPublishedSubmissions(
    [ctx.site.id],
    extensions,
    ctx.$config,
    where,
    opts,
  );
  if (!dbo) throw error404();
  const subjects = await fetchWorkVersionSubjects(dbo.items.map((row) => row.work_version.id));
  return formatSiteWorkDTOFromSubmissions(ctx, dbo, where, { ...opts, subjects });
}
