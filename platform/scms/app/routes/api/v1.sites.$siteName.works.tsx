import type { Route } from './+types/v1.sites.$siteName.works';
import { z } from 'zod';
import { validate, withSecureSiteContext, sites } from '@curvenote/scms-server';
import { extensions } from '../../extensions/server';

const ParamsSchema = z.object({
  collection: z.string().min(1).max(64).optional(),
  kind: z.string().min(1).max(64).optional(), // TODO need https://github.com/curvenote/journals/issues/243
  status: z.union([z.literal('published'), z.literal('in-review')]).optional(),
  limit: z.number().int().min(1).max(500).default(500),
  page: z.number().int().min(0).optional(),
});

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withSecureSiteContext(args);
  const params = new URL(ctx.request.url).searchParams;

  // External sites do not list works, no matter the status
  if (ctx.site.external) {
    return Response.json({ items: [], total: 0, links: {} });
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
  return Response.json(dto);
}
