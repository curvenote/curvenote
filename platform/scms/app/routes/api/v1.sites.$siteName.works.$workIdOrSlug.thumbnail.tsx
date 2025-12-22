import type { Route } from './+types/v1.sites.$siteName.works.$workIdOrSlug.thumbnail';
import { error404, httpError } from '@curvenote/scms-core';
import { withInsecureSiteContext, sortSignedUrlQuery, sites } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withInsecureSiteContext(args);

  // no withSecureSiteContext as cdn security is handled by signed urls
  const { siteName, workIdOrSlug } = args.params;
  if (!siteName) throw httpError(400, 'siteName not provided');
  if (!workIdOrSlug) throw httpError(400, 'workId or slug not provided');

  const query = sortSignedUrlQuery(args.request.url);

  if (ctx.site.private && !query)
    throw error404('Not serving thumbnail for private site, without query');

  const thumbnail = await sites.works.thumbnail(ctx, workIdOrSlug, query);
  if (!thumbnail) throw error404('Thumbnail not found');

  return new Response(thumbnail, {
    headers: {
      'Cache-Control': 'max-age=3600',
    },
  });
}
