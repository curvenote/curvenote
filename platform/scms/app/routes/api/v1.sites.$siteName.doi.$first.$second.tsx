import type { Route } from './+types/v1.sites.$siteName.doi.$first.$second';
import { httpError } from '@curvenote/scms-core';
import { withSecureSiteContext, sites } from '@curvenote/scms-server';
import {
  NOT_FOUND_PUBLIC_BURST,
  PRIVATE_CACHE_OPTIONS,
  SEMI_STATIC_BURST_PROTECTION,
  vercelCacheHeaders,
} from 'app/lib/vercel-cache';

/**
 * `GET …/sites/:siteName/doi/:first/:second` → DOI `:first/:second` (e.g. `10.1101` / `711317`).
 * Optional query `tag` — same JSON shape, but resolves to the latest *published* submission version
 * whose `tags` array contains that string (PostgreSQL array `has`, exact string after trim in query param).
 *
 * Responses are edge-cached: a DOI→work mapping is stable and identical for every
 * caller on a public site, and DOI resolvers attract heavy scanner traffic probing
 * unknown DOIs. Successful lookups use the semi-static preset; not-found responses
 * use the burst-protection 404 preset so junk-DOI scans are absorbed by the CDN
 * rather than hitting the origin/DB. Private sites fall back to a private,
 * browser-only cache. The freshness cost: a newly published DOI may 404 (or a stale
 * version may resolve) at the edge until the TTL lapses.
 */
export async function loader(args: Route.LoaderArgs) {
  const ctx = await withSecureSiteContext(args);
  if (ctx.site.external) {
    throw httpError(405, 'External sites do not accept submissions');
  }

  const { first, second } = args.params;
  if (!first || !second) throw httpError(400, 'Malformed DOI params');

  const doiLookup = `${decodeURIComponent(first)}/${decodeURIComponent(second)}`;
  const tagRaw = new URL(args.request.url).searchParams.get('tag');
  const tag = tagRaw?.trim() ? tagRaw.trim() : undefined;

  try {
    const dto = await sites.doi(ctx, doiLookup, tag ? { tag } : undefined);
    const headers = vercelCacheHeaders(
      ctx.site.private ? PRIVATE_CACHE_OPTIONS : SEMI_STATIC_BURST_PROTECTION,
    );
    return Response.json(dto, { headers });
  } catch (err) {
    // `sites.doi` signals not-found by throwing a 404 Response (invalid DOI,
    // unknown DOI, or absent tag). Re-emit it with edge-cache headers so the CDN
    // absorbs repeat scans; preserve the original body and statusText so the
    // distinct 404 messages are unchanged.
    if (err instanceof Response && err.status === 404) {
      const nfHeaders = vercelCacheHeaders(
        ctx.site.private ? PRIVATE_CACHE_OPTIONS : NOT_FOUND_PUBLIC_BURST,
      );
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
