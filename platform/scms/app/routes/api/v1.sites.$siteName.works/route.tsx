import type { Route } from './+types/route';
import { z } from 'zod';
import { validate, withSecureSiteContext } from '@curvenote/scms-server';
import { extensions } from '../../../extensions/server';
import {
  PRIVATE_CACHE_OPTIONS,
  SEMI_STATIC_BURST_PROTECTION,
  vercelCacheHeaders,
} from 'app/lib/vercel-cache';
import { listPublishedWorks } from './db.server';

/** Default page size when the client omits `limit` / `page` (offset pagination is always applied). */
const DEFAULT_WORKS_LIMIT = 10;

/**
 * Minimum trigram-friendly search length. Substrings shorter than 3 chars can't
 * use the pg_trgm GIN indexes and match nearly everything, so they are dropped
 * (mirrors the submissions-index search contract).
 */
const WORKS_SEARCH_MIN_LENGTH = 3;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const ParamsSchema = z.object({
  collection: z.string().min(1).max(64).optional(),
  kind: z.string().min(1).max(64).optional(), // TODO kind name should be url-safe
  status: z.union([z.literal('published'), z.literal('in-review')]).optional(),
  /** Case-insensitive substring search across title / authors / DOI. */
  q: z.preprocess((v) => {
    if (typeof v !== 'string') return undefined;
    const trimmed = v.trim();
    return trimmed.length >= WORKS_SEARCH_MIN_LENGTH ? trimmed : undefined;
  }, z.string().min(WORKS_SEARCH_MIN_LENGTH).max(200).optional()),
  /** Publication-date sort direction; defaults to newest first. */
  sort: z.enum(['published_desc', 'published_asc']).default('published_desc'),
  /** Inclusive ISO `yyyy-mm-dd` lower bound on `date_published`. */
  from: z.preprocess(
    (v) => (typeof v === 'string' && ISO_DATE.test(v) ? v : undefined),
    z.string().optional(),
  ),
  /** Inclusive ISO `yyyy-mm-dd` upper bound on `date_published`. */
  to: z.preprocess(
    (v) => (typeof v === 'string' && ISO_DATE.test(v) ? v : undefined),
    z.string().optional(),
  ),
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

  const { limit, page, sort, ...where } = validate(ParamsSchema, {
    collection: params.get('collection') ?? undefined,
    kind: params.get('kind') ?? undefined,
    status: params.get('status') ?? undefined,
    q: params.get('q') ?? undefined,
    sort: params.get('sort') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    limit: params.has('limit') ? parseInt(params.get('limit')!, 10) : undefined,
    page: params.has('page') ? parseInt(params.get('page')!, 10) : undefined,
  });

  const dto = await listPublishedWorks(ctx, extensions, where, { page, limit, sort });
  const headers = vercelCacheHeaders(
    ctx.site.private ? PRIVATE_CACHE_OPTIONS : SEMI_STATIC_BURST_PROTECTION,
  );
  return Response.json(dto, { headers });
}
