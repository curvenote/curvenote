import type { Route } from './+types/v1.doi.$first.$second';
import { httpError } from '@curvenote/scms-core';
import { withContext, doi } from '@curvenote/scms-server';
import {
  NOT_FOUND_PUBLIC_BURST,
  SEMI_STATIC_BURST_PROTECTION,
  vercelCacheHeaders,
} from 'app/lib/vercel-cache';

/**
 * `GET …/doi/:first/:second` — resolve a DOI (e.g. `10.1101` / `711317`) to a published work
 * **without a site name**, for site-less consumers like the openrxiv `/content/*` routes.
 * Site-agnostic sibling of `…/sites/:siteName/doi/:first/:second`; resolution lives in
 * `doi.resolve`. Optional `tag` query narrows to the version carrying that tag.
 *
 * Responses are edge-cached: a DOI→work mapping is stable and identical for every caller, and
 * these resolvers attract heavy scanner traffic. Hits use the semi-static preset; 404s use the
 * burst-protection preset so junk-DOI scans are absorbed by the CDN. Resolution is public-only,
 * so there is no private-cache branch. Freshness cost: a newly published DOI may 404 (or a
 * stale version resolve) at the edge until the TTL lapses.
 */
export async function loader(args: Route.LoaderArgs) {
  const ctx = await withContext(args);

  const { first, second } = args.params;
  if (!first || !second) throw httpError(400, 'Malformed DOI params');

  const doiLookup = `${decodeURIComponent(first)}/${decodeURIComponent(second)}`;
  const tagRaw = new URL(args.request.url).searchParams.get('tag');
  const tag = tagRaw?.trim() ? tagRaw.trim() : undefined;

  try {
    const dto = await doi.resolve(ctx, doiLookup, tag ? { tag } : undefined);
    const headers = vercelCacheHeaders(SEMI_STATIC_BURST_PROTECTION);
    return Response.json(dto, { headers });
  } catch (err) {
    // `doi.resolve` signals not-found by throwing a 404 Response (invalid DOI, unknown DOI,
    // or absent tag). Re-emit it with edge-cache headers so the CDN absorbs repeat scans;
    // preserve the original body and statusText so the distinct 404 messages are unchanged.
    if (err instanceof Response && err.status === 404) {
      const nfHeaders = vercelCacheHeaders(NOT_FOUND_PUBLIC_BURST);
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
