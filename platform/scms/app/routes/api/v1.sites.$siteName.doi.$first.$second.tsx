import type { Route } from './+types/v1.sites.$siteName.doi.$first.$second';
import { httpError } from '@curvenote/scms-core';
import { withSecureSiteContext, sites } from '@curvenote/scms-server';

/**
 * `GET …/sites/:siteName/doi/:first/:second` → DOI `:first/:second` (e.g. `10.1101` / `711317`).
 * Optional query `tag` — same JSON shape, but resolves to the latest *published* submission version
 * whose `tags` array contains that string (PostgreSQL array `has`, exact string after trim in query param).
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

  const dto = await sites.doi(ctx, doiLookup, tag ? { tag } : undefined);
  return Response.json(dto);
}
