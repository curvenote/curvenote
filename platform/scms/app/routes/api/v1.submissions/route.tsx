import type { Route } from './+types/route';
import { z } from 'zod';
import { validate, withContext } from '@curvenote/scms-server';
import { listSubmissionCatalog } from './db.server';
import { parseSiteQueryParam } from './public-sites.server';
import { extensions } from '../../../extensions/server';
import { SEMI_STATIC_BURST_PROTECTION, vercelCacheHeaders } from 'app/lib/vercel-cache';

const DEFAULT_SUBMISSIONS_LIMIT = 10;
const SUBMISSIONS_SEARCH_MIN_LENGTH = 3;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoCalendarDate(v: string): boolean {
  if (!ISO_DATE.test(v)) return false;
  const parsed = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === v;
}

const IsoCalendarDateParam = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z
    .string()
    .refine(isValidIsoCalendarDate, {
      message: 'Expected a valid calendar date in yyyy-mm-dd form',
    })
    .optional(),
);

const ParamsSchema = z.object({
  site: z.array(z.string().min(1).max(64)).optional(),
  collection: z.string().min(1).max(64).optional(),
  kind: z.string().min(1).max(64).optional(),
  status: z.union([z.literal('published'), z.literal('in-review')]).optional(),
  q: z.preprocess((v) => {
    if (typeof v !== 'string') return undefined;
    const trimmed = v.trim();
    return trimmed.length >= SUBMISSIONS_SEARCH_MIN_LENGTH ? trimmed : undefined;
  }, z.string().min(SUBMISSIONS_SEARCH_MIN_LENGTH).max(200).optional()),
  subject: z.preprocess((v) => {
    if (typeof v !== 'string') return undefined;
    const trimmed = v.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().min(1).max(40).optional()),
  sort: z.enum(['published_desc', 'published_asc']).default('published_desc'),
  from: IsoCalendarDateParam,
  to: IsoCalendarDateParam,
  limit: z.number().int().min(1).max(500).default(DEFAULT_SUBMISSIONS_LIMIT),
  page: z.number().int().min(0).default(0),
});

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withContext(args);
  const url = new URL(ctx.request.url);
  const site = parseSiteQueryParam(url);

  const {
    limit,
    page,
    sort,
    site: siteNames,
    ...where
  } = validate(ParamsSchema, {
    site,
    collection: url.searchParams.get('collection') ?? undefined,
    kind: url.searchParams.get('kind') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    q: url.searchParams.get('q') ?? undefined,
    subject: url.searchParams.get('subject') ?? undefined,
    sort: url.searchParams.get('sort') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
    limit: url.searchParams.has('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined,
    page: url.searchParams.has('page') ? parseInt(url.searchParams.get('page')!, 10) : undefined,
  });

  const dto = await listSubmissionCatalog(
    ctx,
    extensions,
    { ...where, site: siteNames },
    { page, limit, sort },
  );
  const headers = vercelCacheHeaders(SEMI_STATIC_BURST_PROTECTION);
  return Response.json(dto, { headers });
}
