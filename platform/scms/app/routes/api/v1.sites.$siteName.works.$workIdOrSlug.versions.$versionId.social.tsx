import type { Route } from './+types/v1.sites.$siteName.works.$workIdOrSlug.versions.$versionId.social';
import { error404, httpError } from '@curvenote/scms-core';
import { withInsecureSiteContext, sites } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withInsecureSiteContext(args);

  // no withSecureSiteContext as cdn security is handled by signed urls
  const { siteName, workIdOrSlug, versionId } = args.params;
  if (!siteName) throw httpError(400, 'siteName not provided');
  if (!workIdOrSlug) throw httpError(400, 'workId or slug not provided');
  if (!versionId) throw httpError(400, 'versionId not provided');
  if (ctx.site.private) throw error404('Not serving social image for private site, without query');

  // TODO - use the version Id to get the correct thumbnail
  console.log('Getting social image for', siteName, workIdOrSlug, versionId);
  const social = await sites.works.social(ctx, workIdOrSlug, versionId);
  // const thumbnail = await sites.works.versions.thumbnail(ctx, versionId, query);
  // TODO - serve up a default curvenote journals thumbnail?
  if (!social) throw error404('Social image only available for published works');

  return new Response(social, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'max-age=86400',
    },
  });
}
