import type { Route } from './+types/v1.sites.$siteName.works.$workIdOrSlug.versions.$versionId.thumbnail';
import { httpError } from '@curvenote/scms-core';
import { withInsecureSiteContext, sites, sortSignedUrlQuery } from '@curvenote/scms-server';
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
  const query = sortSignedUrlQuery(args.request.url);

  if (ctx.site.private && !query) {
    return Response.json(
      { status: 404, message: 'Not serving thumbnail for private site, without query' },
      { status: 404, headers: vercelCacheHeaders(PRIVATE_CACHE_OPTIONS) },
    );
  }

  // this just gets the thumbnail from the version directly, workIdOrSlug is not actually used
  const thumbnail = await sites.works.versions.thumbnail(ctx, versionId, query);
  if (!thumbnail) {
    const h = vercelCacheHeaders(ctx.site.private ? PRIVATE_CACHE_OPTIONS : NOT_FOUND_PUBLIC_BURST);
    return Response.json({ status: 404, message: 'Thumbnail not found' }, { status: 404, headers: h });
  }
  const headers = vercelCacheHeaders({
    maxAge: 3600,
    sMaxAge: 3600,
    staleWhileRevalidate: 3600,
    staleIfError: 86400,
  });
  return new Response(thumbnail, {
    headers,
  });
}
