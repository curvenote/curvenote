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

/**
 * True only when `v` is a real calendar date in strict `yyyy-mm-dd` form. The
 * shape regex alone admits impossible dates (`2024-13-45`, `2024-02-30`); we
 * confirm by parsing as UTC and round-tripping back to the same string. The
 * round-trip is what rejects both out-of-range components (which parse to
 * `Invalid Date`) and overflow that `Date` would otherwise silently normalize
 * (`2024-02-30` → `2024-03-01`). Without this, an invalid `to` flows into
 * `toExclusiveDateUpperBound` and yields `"NaN-NaN-NaN"`, which sorts after every
 * digit and silently disables the upper bound instead of erroring.
 */
function isValidIsoCalendarDate(v: string): boolean {
  if (!ISO_DATE.test(v)) return false;
  const parsed = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === v;
}

/**
 * Optional inclusive `yyyy-mm-dd` bound on `date_published`. Rejects
 * calendar-invalid input with a 400 (via `validate`) rather than letting it
 * degrade the filter silently.
 */
const IsoCalendarDateParam = z.preprocess(
  // An absent or empty/whitespace-only param is treated as "no bound"; a
  // non-empty value must be a valid calendar date or `refine` rejects it (400).
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z
    .string()
    .refine(isValidIsoCalendarDate, {
      message: 'Expected a valid calendar date in yyyy-mm-dd form',
    })
    .optional(),
);

const ParamsSchema = z.object({
  collection: z.string().min(1).max(64).optional(),
  kind: z.string().min(1).max(64).optional(), // TODO kind name should be url-safe
  status: z.union([z.literal('published'), z.literal('in-review')]).optional(),
  /** Case-insensitive substring search across title / authors / DOI / affiliations (affiliation branch skips common boilerplate tokens). */
  q: z.preprocess((v) => {
    if (typeof v !== 'string') return undefined;
    const trimmed = v.trim();
    return trimmed.length >= WORKS_SEARCH_MIN_LENGTH ? trimmed : undefined;
  }, z.string().min(WORKS_SEARCH_MIN_LENGTH).max(200).optional()),
  /** Case-insensitive exact match on MyST `subject` (whitespace-trimmed). */
  subject: z.preprocess((v) => {
    if (typeof v !== 'string') return undefined;
    const trimmed = v.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().min(1).max(40).optional()),
  /** Publication-date sort direction; defaults to newest first. */
  sort: z.enum(['published_desc', 'published_asc']).default('published_desc'),
  /** Inclusive ISO `yyyy-mm-dd` lower bound on `date_published`. */
  from: IsoCalendarDateParam,
  /** Inclusive ISO `yyyy-mm-dd` upper bound on `date_published`. */
  to: IsoCalendarDateParam,
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
    subject: params.get('subject') ?? undefined,
    sort: params.get('sort') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    limit: params.has('limit') ? parseInt(params.get('limit')!, 10) : undefined,
    page: params.has('page') ? parseInt(params.get('page')!, 10) : undefined,
  });

  const dto = await listPublishedWorks(
    ctx,
    extensions,
    where,
    { page, limit, sort },
    ctx.request.signal,
  );
  const headers = vercelCacheHeaders(
    ctx.site.private ? PRIVATE_CACHE_OPTIONS : SEMI_STATIC_BURST_PROTECTION,
  );
  return Response.json(dto, { headers });
}
