import type { Route } from './+types/v1.sites.$siteName.works';
import { z } from 'zod';
import { validate, withSecureSiteContext, sites } from '@curvenote/scms-server';
import { extensions } from '../../extensions/server';
import {
  PRIVATE_CACHE_OPTIONS,
  SEMI_STATIC_BURST_PROTECTION,
  vercelCacheHeaders,
} from 'app/lib/vercel-cache';

const ParamsSchema = z.object({
  collection: z.string().min(1).max(64).optional(),
  kind: z.string().min(1).max(64).optional(), // TODO kind name should be url-safe
  status: z.union([z.literal('published'), z.literal('in-review')]).optional(),
  limit: z.number().int().min(1).max(500).default(500),
  page: z.number().int().min(0).optional(),
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
    limit: params.get('limit') ? parseInt(params.get('limit')!) : undefined,
    page: params.get('page') ? parseInt(params.get('page')!) : undefined,
  });

  // offset based pagination
  const dto = await sites.submissions.published.list(ctx, extensions, where, { page, limit });
  const headers = vercelCacheHeaders(
    ctx.site.private ? PRIVATE_CACHE_OPTIONS : SEMI_STATIC_BURST_PROTECTION,
  );
  return Response.json(dto, { headers });
}
