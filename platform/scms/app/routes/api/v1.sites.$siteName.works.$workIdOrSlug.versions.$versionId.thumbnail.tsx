import type { Route } from './+types/v1.sites.$siteName.works.$workIdOrSlug.versions.$versionId.thumbnail';
import { error404, httpError } from '@curvenote/scms-core';
import { withInsecureSiteContext, sites, sortSignedUrlQuery } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withInsecureSiteContext(args);

  // no withSecureSiteContext as cdn security is handled by signed urls
  const { siteName, workIdOrSlug, versionId } = args.params;
  if (!siteName) throw httpError(400, 'siteName not provided');
  if (!workIdOrSlug) throw httpError(400, 'workId or slug not provided');
  if (!versionId) throw httpError(400, 'versionId not provided');

  const query = sortSignedUrlQuery(args.request.url);

  if (ctx.site.private && !query)
    throw error404('Not serving thumbnail for private site, without query');

  // this just gets the thumbnail from the version directly, workIdOrSlug is not actually used
  const thumbnail = await sites.works.versions.thumbnail(ctx, versionId, query);
  if (!thumbnail) throw error404('Thumbnail not found');
  return new Response(thumbnail, {
    headers: {
      'Cache-Control': 'max-age=3600',
    },
  });
}
