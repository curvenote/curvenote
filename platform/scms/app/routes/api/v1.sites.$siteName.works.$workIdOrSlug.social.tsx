import type { Route } from './+types/v1.sites.$siteName.works.$workIdOrSlug.social';
import { error404, httpError } from '@curvenote/scms-core';
import { withInsecureSiteContext, sites } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withInsecureSiteContext(args);

  // no withSecureSiteContext as cdn security is handled by signed urls
  const { siteName, workIdOrSlug } = args.params;
  if (!siteName) throw httpError(400, 'siteName not provided');
  if (!workIdOrSlug) throw httpError(400, 'workId or slug not provided');

  if (ctx.site.private) throw error404('Not serving social image for private site');

  const social = await sites.works.social(ctx, workIdOrSlug);
  if (!social) throw error404('Social image not found');

  return new Response(social, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'max-age=86400',
    },
  });
}
