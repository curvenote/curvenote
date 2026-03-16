import type { Route } from './+types/v1.sites.$siteName.works.$workIdOrSlug.published';
import { httpError } from '@curvenote/scms-core';
import { withSecureSiteContext, sites } from '@curvenote/scms-server';
import {
  PRIVATE_CACHE_OPTIONS,
  SEMI_STATIC_BURST_PROTECTION,
  vercelCacheHeaders,
} from 'app/lib/vercel-cache';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withSecureSiteContext(args);
  const { workIdOrSlug } = args.params;
  if (!workIdOrSlug) throw httpError(400, 'Missing workId or slug');
  const dto = await sites.submissions.published.get(ctx, workIdOrSlug);
  const headers = vercelCacheHeaders(
    ctx.site.private ? PRIVATE_CACHE_OPTIONS : SEMI_STATIC_BURST_PROTECTION,
  );
  return Response.json(dto, { headers });
}
