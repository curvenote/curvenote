import type { Route } from './+types/route';
import { httpError } from '@curvenote/scms-core';
import { withContext } from '@curvenote/scms-server';
import { parseSingleSiteQueryParam } from '../v1.submissions/public-sites.server';
import { resolveGlobalCatalogDoi } from './resolve.server';
import {
  NOT_FOUND_PUBLIC_BURST,
  PRIVATE_CACHE_OPTIONS,
  SEMI_STATIC_BURST_PROTECTION,
  vercelCacheHeaders,
} from 'app/lib/vercel-cache';

/**
 * `GET …/doi/:first/:second` → DOI `:first/:second` across public catalog sites.
 * Optional `site` scopes to one public site (`sites` accepted as an alias);
 * optional `tag` picks a tagged version.
 * Without `site`, returns the deterministic first match across public sites.
 */
export async function loader(args: Route.LoaderArgs) {
  const ctx = await withContext(args);
  const { first, second } = args.params;
  if (!first || !second) throw httpError(400, 'Malformed DOI params');

  const doiLookup = `${decodeURIComponent(first)}/${decodeURIComponent(second)}`;
  const url = new URL(args.request.url);
  const site = parseSingleSiteQueryParam(url);
  const tagRaw = url.searchParams.get('tag');
  const tag = tagRaw?.trim() ? tagRaw.trim() : undefined;

  try {
    const dto = await resolveGlobalCatalogDoi(ctx, doiLookup, {
      siteName: site,
      tag,
    });
    const headers = vercelCacheHeaders(site ? SEMI_STATIC_BURST_PROTECTION : PRIVATE_CACHE_OPTIONS);
    return Response.json(dto, { headers });
  } catch (err) {
    if (err instanceof Response && err.status === 404) {
      const nfHeaders = vercelCacheHeaders(site ? NOT_FOUND_PUBLIC_BURST : PRIVATE_CACHE_OPTIONS);
      const body = await err.text();
      return new Response(body, {
        status: 404,
        statusText: err.statusText,
        headers: { ...Object.fromEntries(err.headers), ...nfHeaders },
      });
    }
    throw err;
  }
}
