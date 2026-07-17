import { httpError, makePaginationLinks, withApiBaseUrl } from '@curvenote/scms-core';
import { z } from 'zod';
import { validate } from '../../api.schemas.js';
import { getPrismaClient } from '../prisma.server.js';
import { authorizeEtlSite } from './auth.server.js';

export const ETL_HISTORY_DEFAULT_SINCE_HOURS = 24;
export const ETL_HISTORY_MAX_SINCE_DAYS = 7;
export const ETL_HISTORY_MAX_LIMIT = 500;
export const ETL_HISTORY_DEFAULT_LIMIT = 500;

export type EtlHistoryItem = {
  doi: string;
  version?: string;
  date_created: string;
};

export type EtlHistoryListingDTO = {
  items: EtlHistoryItem[];
  total: number;
  links: {
    self: string;
    prev?: string;
    next?: string;
  };
};

const ParamsSchema = z.object({
  site: z.string().trim().min(1),
  since: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(ETL_HISTORY_MAX_LIMIT).default(ETL_HISTORY_DEFAULT_LIMIT),
  page: z.number().int().min(0).default(0),
});

/** Parse and bound the `since` cursor for ETL history listing. */
export function resolveEtlHistorySince(
  sinceParam: string | undefined,
  now: Date = new Date(),
): string {
  if (!sinceParam?.trim()) {
    return new Date(now.getTime() - ETL_HISTORY_DEFAULT_SINCE_HOURS * 60 * 60 * 1000).toISOString();
  }

  const parsed = new Date(sinceParam.trim());
  if (Number.isNaN(parsed.getTime())) {
    throw httpError(400, 'since must be an ISO 8601 UTC datetime');
  }

  const maxLookbackMs = ETL_HISTORY_MAX_SINCE_DAYS * 24 * 60 * 60 * 1000;
  const earliestAllowed = now.getTime() - maxLookbackMs;
  if (parsed.getTime() < earliestAllowed) {
    throw httpError(400, `since must be within the last ${ETL_HISTORY_MAX_SINCE_DAYS} days`);
  }
  if (parsed.getTime() > now.getTime()) {
    throw httpError(400, 'since must not be in the future');
  }

  return parsed.toISOString();
}

const VERSION_TAG_RE = /^v(\d+)$/i;

/**
 * First `v{n}` tag on the submission version (ETL `version_tag`), normalized to `v{n}`.
 * Non-version tags are ignored; multiple `v{n}` tags are not expected — first wins.
 */
export function pickEtlHistoryVersion(tags: string[]): string | undefined {
  for (const raw of tags) {
    const m = VERSION_TAG_RE.exec(raw.trim());
    if (m) return `v${m[1]}`;
  }
  return undefined;
}

function buildHistoryLinks(
  request: Request,
  params: { site: string; since: string; page: number; limit: number },
  total: number,
): EtlHistoryListingDTO['links'] {
  const asApiUrl = withApiBaseUrl(request);
  const selfUrl = new URL(asApiUrl('/etl/history'));
  selfUrl.searchParams.set('site', params.site);
  selfUrl.searchParams.set('since', params.since);
  return makePaginationLinks({ self: selfUrl.toString() }, total, {
    page: params.page,
    limit: params.limit,
  });
}

export async function etlHistoryFromRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') throw httpError(405, 'Method Not Allowed');

  const searchParams = new URL(request.url).searchParams;
  const {
    site,
    since: sinceParam,
    limit,
    page,
  } = validate(ParamsSchema, {
    site: searchParams.get('site') ?? '',
    since: searchParams.get('since') ?? undefined,
    limit: searchParams.has('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
    page: searchParams.has('page') ? parseInt(searchParams.get('page')!, 10) : undefined,
  });

  const { site: authorizedSite } = await authorizeEtlSite(request, site);
  const since = resolveEtlHistorySince(sinceParam);
  const prisma = await getPrismaClient();

  const where = {
    status: 'PUBLISHED' as const,
    date_created: { gte: since },
    submission: { site_id: authorizedSite.id },
    // Exclude null/empty DOIs so count, take, and items stay aligned.
    // Writers (e.g. ETL register-work) trim before save; whitespace-only DOIs are not expected.
    work_version: {
      AND: [{ doi: { not: null } }, { doi: { not: '' } }],
    },
  };

  const [rows, total] = await Promise.all([
    prisma.submissionVersion.findMany({
      where,
      skip: page * limit,
      take: limit,
      orderBy: [{ date_created: 'asc' }, { id: 'asc' }],
      select: {
        date_created: true,
        tags: true,
        work_version: { select: { doi: true } },
      },
    }),
    prisma.submissionVersion.count({ where }),
  ]);

  const items: EtlHistoryItem[] = rows.map((row) => {
    const item: EtlHistoryItem = {
      // Non-null/non-empty from `where`; trim only for response normalization.
      doi: row.work_version.doi!.trim(),
      date_created: row.date_created,
    };
    const version = pickEtlHistoryVersion(row.tags);
    if (version) item.version = version;
    return item;
  });

  const dto: EtlHistoryListingDTO = {
    items,
    total,
    links: buildHistoryLinks(request, { site, since, page, limit }, total),
  };

  return Response.json(dto);
}
