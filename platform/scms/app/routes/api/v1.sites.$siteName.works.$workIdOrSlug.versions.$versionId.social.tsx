import type { Route } from './+types/v1.sites.$siteName.works.$workIdOrSlug.versions.$versionId.social';
import { httpError } from '@curvenote/scms-core';
import { withInsecureSiteContext, sites } from '@curvenote/scms-server';
import {
  NOT_FOUND_PUBLIC_BURST,
  PRIVATE_CACHE_OPTIONS,
  vercelCacheHeaders,
} from 'app/lib/vercel-cache';
import { pathSegmentProbe404IfObvious } from 'app/lib/work-segment-probe';

export async function loader(args: Route.LoaderArgs) {
  const { siteName, workIdOrSlug, versionId } = args.params;
  if (!siteName) throw httpError(400, 'siteName not provided');
  if (!workIdOrSlug) throw httpError(400, 'workId or slug not provided');
  if (!versionId) throw httpError(400, 'versionId not provided');

  const probeWork = pathSegmentProbe404IfObvious(workIdOrSlug);
  if (probeWork) return probeWork;
  const probeVer = pathSegmentProbe404IfObvious(versionId);
  if (probeVer) return probeVer;

  const ctx = await withInsecureSiteContext(args);

  // no withSecureSiteContext as cdn security is handled by signed urls
  if (ctx.site.private) {
    return Response.json(
      { status: 404, message: 'Not serving social image for private site, without query' },
      { status: 404, headers: vercelCacheHeaders(PRIVATE_CACHE_OPTIONS) },
    );
  }

  // TODO - use the version Id to get the correct thumbnail
  console.log('Getting social image for', siteName, workIdOrSlug, versionId);
  const social = await sites.works.social(ctx, workIdOrSlug, versionId);
  // const thumbnail = await sites.works.versions.thumbnail(ctx, versionId, query);
  // TODO - serve up a default curvenote journals thumbnail?
  if (!social) {
    return Response.json(
      { status: 404, message: 'Social image only available for published works' },
      { status: 404, headers: vercelCacheHeaders(NOT_FOUND_PUBLIC_BURST) },
    );
  }

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
