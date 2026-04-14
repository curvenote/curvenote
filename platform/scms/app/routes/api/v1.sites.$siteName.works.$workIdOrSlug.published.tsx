import type { Route } from './+types/v1.sites.$siteName.works.$workIdOrSlug.published';
import { httpError, MESSAGE_404 } from '@curvenote/scms-core';
import { withSecureSiteContext, sites } from '@curvenote/scms-server';
import {
  NOT_FOUND_PUBLIC_BURST,
  PRIVATE_CACHE_OPTIONS,
  SEMI_STATIC_BURST_PROTECTION,
  vercelCacheHeaders,
} from 'app/lib/vercel-cache';
import { pathSegmentProbe404IfObvious } from 'app/lib/work-segment-probe';

export async function loader(args: Route.LoaderArgs) {
  const { workIdOrSlug } = args.params;
  if (!workIdOrSlug) throw httpError(400, 'Missing workId or slug');

  const probe = pathSegmentProbe404IfObvious(workIdOrSlug);
  if (probe) return probe;

  const ctx = await withSecureSiteContext(args);
  const dto = await sites.submissions.published.get(ctx, workIdOrSlug);
  if (!dto) {
    const nfHeaders = vercelCacheHeaders(
      ctx.site.private ? PRIVATE_CACHE_OPTIONS : NOT_FOUND_PUBLIC_BURST,
    );
    return Response.json(
      { status: 404, message: MESSAGE_404 },
      { status: 404, headers: nfHeaders },
    );
  }
  const headers = vercelCacheHeaders(
    ctx.site.private ? PRIVATE_CACHE_OPTIONS : SEMI_STATIC_BURST_PROTECTION,
  );
  return Response.json(dto, { headers });
}
