import { getPrismaClient } from '../../prisma.server.js';
import {
  httpError,
  isOffsetPaginationRequested,
  getWorkflows,
  registerExtensionWorkflows,
  type ClientExtension,
} from '@curvenote/scms-core';
import { Prisma } from '@curvenote/scms-db';
import {
  siteWorkListingSelect,
  type SubmissionListingDBO,
  type SubmissionListingRowDBO,
} from './listing-select.server.js';

/**
 * Splits the co-located narrow site-work select into the parts needed when the
 * query is rooted at `Submission`:
 *  - `submission` relations + scalars (kind, collection, slugs, work, …)
 *  - the SubmissionVersion fields, minus the nested `submission` (which we
 *    re-attach from the outer query).
 */
function getListingSelects() {
  const { submission, ...submissionVersionSelect } = siteWorkListingSelect;
  return { submissionInnerSelect: submission.select, submissionVersionSelect };
}

/** Publication-date sort direction supported by the public listing. */
export type SubmissionListingSort = 'published_desc' | 'published_asc';

/**
 * Optional listing refinements layered on top of the base site/collection/kind/
 * status filter: a `date_published` window and a pre-resolved set of submission
 * ids (the search path narrows by `q` via raw SQL, then hands the matching ids
 * here so the select/count run through Prisma unchanged).
 */
type ListingExtras = {
  from?: string;
  to?: string;
  ids?: string[];
};

/**
 * Escape only the ILIKE escape character itself (`\`) so a user-supplied
 * backslash matches literally. `%` and `_` are intentionally passed through to
 * Postgres as wildcards, matching the submissions-index search contract.
 */
function escapeIlikePattern(q: string): string {
  return q.replace(/\\/g, '\\\\');
}

/** Narrow a listing to submissions present in every supplied id set. */
function intersectSubmissionIds(...idSets: Array<string[] | undefined>): string[] | undefined {
  const present = idSets.filter((ids): ids is string[] => ids != null);
  if (present.length === 0) return undefined;
  let acc = new Set(present[0]);
  for (const ids of present.slice(1)) {
    const next = new Set<string>();
    for (const id of ids) {
      if (acc.has(id)) next.add(id);
    }
    acc = next;
    if (acc.size === 0) return [];
  }
  return [...acc];
}

/**
 * Inclusive upper bound expressed as the start of the next day, so
 * `date_published < toExclusiveDateUpperBound(to)` matches all timestamps
 * within `to`. Built from UTC components so it never depends on the server
 * timezone; the comparison runs against ISO-string columns that sort
 * chronologically by lexicographic order.
 */
function toExclusiveDateUpperBound(toIsoDate: string): string {
  const next = new Date(`${toIsoDate}T00:00:00Z`);
  // Defense-in-depth: the route schema rejects calendar-invalid dates, but an
  // invalid `Date` here would serialize to "NaN-NaN-NaN" and (sorting after
  // every digit) silently match all rows, disabling the bound. Fail loudly.
  if (Number.isNaN(next.getTime())) {
    throw httpError(400, `Invalid date for upper bound: ${toIsoDate}`);
  }
  next.setUTCDate(next.getUTCDate() + 1);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, '0');
  const day = String(next.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildOrderBy(sort: SubmissionListingSort): Prisma.SubmissionOrderByWithRelationInput[] {
  // `id ASC` is appended as a deterministic tie-breaker so LIMIT/OFFSET pages
  // never shift between requests when rows tie on `date_published`.
  if (sort === 'published_asc') {
    return [{ date_published: 'asc' }, { date_created: 'asc' }, { id: 'asc' }];
  }
  return [{ date_published: 'desc' }, { date_created: 'desc' }, { id: 'asc' }];
}

function siteIdFilter(siteIds: string[]): Prisma.StringFilter | string {
  return siteIds.length === 1 ? siteIds[0] : { in: siteIds };
}

/**
 * Shared filter for the listing: submissions on the requested site(s)
 * (optionally scoped to a collection / kind) that have at least one version in
 * the requested status. Mirrors the previous `submissionVersion.status` +
 * `distinct` semantics.
 *
 * Filters on `site_id` directly (the caller already resolved the sites) rather
 * than joining `Site` by name, so the planner can use the
 * `(site_id, date_published DESC, date_created DESC)` index for both the
 * ordered page scan and the COUNT.
 *
 * `extras` layers on the optional `date_published` window (NULL dates fail the
 * comparison and are excluded, as intended) and the search-resolved id set.
 */
function buildListingWhere(
  siteIds: string[],
  collectionName: string | undefined,
  status: string,
  kind: string | undefined,
  extras?: ListingExtras,
): Prisma.SubmissionWhereInput {
  const where: Prisma.SubmissionWhereInput = {
    site_id: siteIdFilter(siteIds),
    collection: { name: collectionName },
    kind: { name: kind },
    versions: { some: { status } },
  };
  const toExclusive = extras?.to ? toExclusiveDateUpperBound(extras.to) : undefined;
  if (extras?.from || toExclusive) {
    const publishedFilter: Prisma.StringNullableFilter = {};
    if (extras?.from) publishedFilter.gte = extras.from;
    if (toExclusive) publishedFilter.lt = toExclusive;
    where.date_published = publishedFilter;
  }
  if (extras?.ids) {
    where.id = { in: extras.ids };
  }
  return where;
}

/**
 * Resolve the submission ids matching a free-text query via a single raw SQL
 * EXISTS subquery that ILIKE-substrings the newest work versions' title /
 * authors / DOI and the underlying work's DOI. The pg_trgm GIN indexes from
 * `20260526223800_add_submission_search_trgm_indexes` serve these predicates.
 *
 * `immutable_array_to_string(authors, ' ')` MUST match the expression index
 * exactly for the planner to use it.
 */
async function dbSearchSubmissionIds(
  siteIds: string[],
  q: string,
  tx?: Prisma.TransactionClient,
): Promise<string[]> {
  const prisma = await getPrismaClient();
  const pattern = `%${escapeIlikePattern(q)}%`;
  const rows = await (tx ?? prisma).$queryRaw<{ id: string }[]>`
    SELECT s.id FROM "Submission" s
    WHERE s.site_id IN (${Prisma.join(siteIds)})
      AND EXISTS (
        SELECT 1
        FROM "SubmissionVersion" sv
        JOIN "WorkVersion" wv ON wv.id = sv.work_version_id
        LEFT JOIN "Work" w ON w.id = wv.work_id
        WHERE sv.submission_id = s.id
          AND (
            wv.title ILIKE ${pattern}
            OR wv.doi ILIKE ${pattern}
            OR w.doi ILIKE ${pattern}
            OR immutable_array_to_string(wv.authors, ' ') ILIKE ${pattern}
          )
      )
  `;
  return rows.map((r) => r.id);
}

/**
 * Count submissions that have at least one version in the requested status.
 *
 * Rooted at `Submission` (already one row per listing entry) so this is a
 * single SQL COUNT over a semijoin — no longer materialising every matching
 * version id into Node just to read `.length`.
 */
async function dbCountSubmissions(
  siteIds: string[],
  collectionName: string | undefined,
  status: string,
  kind?: string,
  extras?: ListingExtras,
  tx?: Prisma.TransactionClient,
) {
  const prisma = await getPrismaClient();
  return (tx ?? prisma).submission.count({
    where: buildListingWhere(siteIds, collectionName, status, kind, extras),
  });
}

/**
 * List submissions (the latest version in the requested status per submission),
 * ordered by publication date.
 *
 * Rooted at `Submission` rather than `SubmissionVersion`, so there is no
 * `distinct` step: the table already has one row per listing entry, which lets
 * Postgres push LIMIT/OFFSET into an index range scan instead of sorting the
 * full matching set in memory. The latest matching version is pulled via a
 * constrained `take: 1` relation and re-shaped into the RowDBO the formatter
 * expects, so the delivered payload is unchanged.
 */
async function dbQuerySubmissions(
  siteIds: string[],
  collectionName: string | undefined,
  status: string,
  kind?: string,
  opts?: {
    page?: number;
    limit?: number;
    sort?: SubmissionListingSort;
    extras?: ListingExtras;
  },
  tx?: Prisma.TransactionClient,
): Promise<SubmissionListingRowDBO[]> {
  const skip = opts?.limit ? (opts?.page ?? 0) * opts?.limit : undefined;
  const take = opts?.limit;
  const { submissionInnerSelect, submissionVersionSelect } = getListingSelects();
  const prisma = await getPrismaClient();
  const submissions = await (tx ?? prisma).submission.findMany({
    skip,
    take,
    where: buildListingWhere(siteIds, collectionName, status, kind, opts?.extras),
    orderBy: buildOrderBy(opts?.sort ?? 'published_desc'),
    select: {
      ...submissionInnerSelect,
      versions: {
        where: { status },
        orderBy: [{ date_created: 'desc' }],
        take: 1,
        select: submissionVersionSelect,
      },
    },
  });

  return submissions
    .filter((s) => s.versions.length > 0)
    .map((s) => {
      const { versions, ...submission } = s;
      return { ...versions[0], submission } as SubmissionListingRowDBO;
    });
}

/**
 * When filtering on collection across one or more sites, keep only sites whose
 * collection workflow makes the requested status visible for listing.
 */
async function resolveCollectionListingScope(
  siteIds: string[],
  collectionName: string,
  status: string,
  extensions: ClientExtension[],
  config: Parameters<typeof getWorkflows>[0],
): Promise<{ collectionName: string; siteIds: string[] } | null> {
  const prisma = await getPrismaClient();
  const collections = await prisma.collection.findMany({
    where: {
      name: collectionName,
      site_id: { in: siteIds },
    },
    select: { site_id: true, workflow: true },
  });
  const workflows = getWorkflows(config, registerExtensionWorkflows(extensions));
  const eligibleSiteIds = collections
    .filter((c) => workflows[c.workflow]?.states[status]?.visible)
    .map((c) => c.site_id);
  if (eligibleSiteIds.length === 0) return null;
  return { collectionName, siteIds: eligibleSiteIds };
}

export async function dbListLatestPublishedSubmissions(
  siteIds: string[],
  extensions: ClientExtension[],
  config: Parameters<typeof getWorkflows>[0],
  where?: {
    collection?: string;
    kind?: string;
    status?: string;
    q?: string;
    subject?: string;
    from?: string;
    to?: string;
  },
  opts?: { page?: number; limit?: number; sort?: SubmissionListingSort },
): Promise<SubmissionListingDBO | undefined> {
  if (siteIds.length === 0) {
    return { items: [], total: 0 };
  }

  // only allow lookup on status if collection is also provided
  // and limit to allowed statuses for now
  const status: string = where?.status === 'in-review' ? 'IN_REVIEW' : 'PUBLISHED';
  if (status !== 'PUBLISHED' && !where?.collection) {
    throw httpError(
      400,
      'Can only filter by a status other than "published" when also filtering by collection',
    );
  }

  // Search and subject filters narrow to pre-resolved id sets via raw SQL; the
  // select/count then run through the shared Prisma filter. An empty intersection
  // short-circuits.
  let searchIds: string[] | undefined;
  if (where?.q) {
    searchIds = await dbSearchSubmissionIds(siteIds, where.q);
  }
  let subjectIds: string[] | undefined;
  if (where?.subject) {
    subjectIds = await fetchSubmissionIdsBySubjectForSites(siteIds, where.subject, status);
  }
  const filteredIds = intersectSubmissionIds(searchIds, subjectIds);
  if (filteredIds?.length === 0) {
    return { items: [], total: 0 };
  }
  const extras: ListingExtras = { from: where?.from, to: where?.to, ids: filteredIds };
  const queryOpts = { ...opts, extras };

  let activeSiteIds = siteIds;
  let collectionName: string | undefined;
  if (where?.collection) {
    // when filtering on collection, we need to first check if the workflow
    // on the collection is visible for the state[status] being queried
    const scope = await resolveCollectionListingScope(
      siteIds,
      where.collection,
      status,
      extensions,
      config,
    );
    if (!scope) {
      return { items: [], total: 0 };
    }
    collectionName = scope.collectionName;
    activeSiteIds = scope.siteIds;
  }

  if (isOffsetPaginationRequested(opts ?? {})) {
    const [items, total] = await Promise.all([
      dbQuerySubmissions(activeSiteIds, collectionName, status, where?.kind, queryOpts),
      dbCountSubmissions(activeSiteIds, collectionName, status, where?.kind, extras),
    ]);
    return { items, total };
  }

  // no pagination if limit and page are not provided
  // we can still limit, but in this branch we avoid
  // the extra count query
  if (opts?.page === undefined) {
    const items = await dbQuerySubmissions(
      activeSiteIds,
      collectionName,
      status,
      where?.kind,
      queryOpts,
    );
    return { items, total: items.length };
  }

  return undefined;
}

/**
 * Resolve submission ids whose work metadata subject matches exactly (case- and
 * whitespace-insensitive). Scoped to versions in the requested listing status,
 * mirroring the public works listing semijoin.
 */
async function fetchSubmissionIdsBySubjectForSites(
  siteIds: string[],
  subject: string,
  status: string,
  tx?: Prisma.TransactionClient,
): Promise<string[]> {
  const normalized = subject.trim();
  if (!normalized) return [];

  const prisma = await getPrismaClient();
  const rows = await (tx ?? prisma).$queryRaw<{ id: string }[]>`
    SELECT s.id
    FROM "Submission" s
    WHERE s.site_id IN (${Prisma.join(siteIds)})
      AND EXISTS (
        SELECT 1
        FROM "SubmissionVersion" sv
        JOIN "WorkVersion" wv ON wv.id = sv.work_version_id
        WHERE sv.submission_id = s.id
          AND sv.status = ${status}
          AND LOWER(TRIM(wv.metadata #>> '{frontmatter.myst,subject}')) = LOWER(${normalized})
      )
  `;
  return rows.map((row) => row.id);
}
