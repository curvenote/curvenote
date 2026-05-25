import type { Route } from './+types/v1.sites.$siteName.works';
import { z } from 'zod';
import { validate, withSecureSiteContext, sites } from '@curvenote/scms-server';
import { extensions } from '../../extensions/server';
import {
  PRIVATE_CACHE_OPTIONS,
  SEMI_STATIC_BURST_PROTECTION,
  vercelCacheHeaders,
} from 'app/lib/vercel-cache';

/** Default page size when the client omits `limit` / `page` (offset pagination is always applied). */
const DEFAULT_WORKS_LIMIT = 10;

const ParamsSchema = z.object({
  collection: z.string().min(1).max(64).optional(),
  kind: z.string().min(1).max(64).optional(), // TODO kind name should be url-safe
  status: z.union([z.literal('published'), z.literal('in-review')]).optional(),
  limit: z.number().int().min(1).max(500).default(DEFAULT_WORKS_LIMIT),
  page: z.number().int().min(0).default(0),
});

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withSecureSiteContext(args);
  const params = new URL(ctx.request.url).searchParams;

  // External sites do not list works, no matter the status
  if (ctx.site.external) {
    const headers = vercelCacheHeaders(
      ctx.site.private ? PRIVATE_CACHE_OPTIONS : SEMI_STATIC_BURST_PROTECTION,
    );
    return Response.json({ items: [], total: 0, links: {} }, { headers });
  }

  const { limit, page, ...where } = validate(ParamsSchema, {
    collection: params.get('collection') ?? undefined,
    kind: params.get('kind') ?? undefined,
    status: params.get('status') ?? undefined,
    limit: params.has('limit') ? parseInt(params.get('limit')!, 10) : undefined,
    page: params.has('page') ? parseInt(params.get('page')!, 10) : undefined,
  });

  const dto = await sites.submissions.published.list(ctx, extensions, where, { page, limit });
  const headers = vercelCacheHeaders(
    ctx.site.private ? PRIVATE_CACHE_OPTIONS : SEMI_STATIC_BURST_PROTECTION,
  );
  return Response.json(dto, { headers });
}
