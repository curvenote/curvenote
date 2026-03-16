import type { Route } from './+types/v1.sites.$siteName.works.$workIdOrSlug.social';
import { error404, httpError } from '@curvenote/scms-core';
import { withInsecureSiteContext, sites } from '@curvenote/scms-server';
import { vercelCacheHeaders } from 'app/lib/vercel-cache';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withInsecureSiteContext(args);

  // no withSecureSiteContext as cdn security is handled by signed urls
  const { siteName, workIdOrSlug } = args.params;
  if (!siteName) throw httpError(400, 'siteName not provided');
  if (!workIdOrSlug) throw httpError(400, 'workId or slug not provided');

  if (ctx.site.private) throw error404('Not serving social image for private site');

  const social = await sites.works.social(ctx, workIdOrSlug);
  if (!social) throw error404('Social image not found');

  const headers = vercelCacheHeaders({
    maxAge: 3600,
    sMaxAge: 86400,
    staleIfError: 86400,
  });
  return new Response(social, {
    headers: {
      'Content-Type': 'image/png',
      ...headers,
    },
  });
}
