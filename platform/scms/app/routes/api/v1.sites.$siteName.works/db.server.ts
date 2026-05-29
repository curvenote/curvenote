import { getPrismaClient, type SiteContext } from '@curvenote/scms-server';
import {
  error404,
  httpError,
  isOffsetPaginationRequested,
  getWorkflows,
  registerExtensionWorkflows,
  type ClientExtension,
} from '@curvenote/scms-core';
import type { Prisma } from '@curvenote/scms-db';
import { formatSiteWorkDTOFromSubmissions, siteWorkListingSelect } from './format.server';
import type { ListDBO, RowDBO } from './format.server';

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
export type WorksSort = 'published_desc' | 'published_asc';

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

function buildOrderBy(sort: WorksSort): Prisma.SubmissionOrderByWithRelationInput[] {
  // `id ASC` is appended as a deterministic tie-breaker so LIMIT/OFFSET pages
  // never shift between requests when rows tie on `date_published`.
  if (sort === 'published_asc') {
    return [{ date_published: 'asc' }, { date_created: 'asc' }, { id: 'asc' }];
  }
  return [{ date_published: 'desc' }, { date_created: 'desc' }, { id: 'asc' }];
}

/**
 * Shared filter for the listing: submissions on this site (optionally scoped to
 * a collection / kind) that have at least one version in the requested status.
 * Mirrors the previous `submissionVersion.status` + `distinct` semantics.
 *
 * Filters on `site_id` directly (the caller already resolved the site) rather
 * than joining `Site` by name, so the planner can use the
 * `(site_id, date_published DESC, date_created DESC)` index for both the
 * ordered page scan and the COUNT.
 *
 * `extras` layers on the optional `date_published` window (NULL dates fail the
 * comparison and are excluded, as intended) and the search-resolved id set.
 */
function buildListingWhere(
  siteId: string,
  collectionName: string | undefined,
  status: string,
  kind: string | undefined,
  extras?: ListingExtras,
): Prisma.SubmissionWhereInput {
  const where: Prisma.SubmissionWhereInput = {
    site_id: siteId,
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
  siteId: string,
  q: string,
  tx?: Prisma.TransactionClient,
): Promise<string[]> {
  const prisma = await getPrismaClient();
  const pattern = `%${escapeIlikePattern(q)}%`;
  const rows = await (tx ?? prisma).$queryRaw<{ id: string }[]>`
    SELECT s.id FROM "Submission" s
    WHERE s.site_id = ${siteId}
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
  siteId: string,
  collectionName: string | undefined,
  status: string,
  kind?: string,
  extras?: ListingExtras,
  tx?: Prisma.TransactionClient,
) {
  const prisma = await getPrismaClient();
  return (tx ?? prisma).submission.count({
    where: buildListingWhere(siteId, collectionName, status, kind, extras),
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
  siteId: string,
  collectionName: string | undefined,
  status: string,
  kind?: string,
  opts?: { page?: number; limit?: number; sort?: WorksSort; extras?: ListingExtras },
  tx?: Prisma.TransactionClient,
): Promise<RowDBO[]> {
  const skip = opts?.limit ? (opts?.page ?? 0) * opts?.limit : undefined;
  const take = opts?.limit;
  const { submissionInnerSelect, submissionVersionSelect } = getListingSelects();
  const prisma = await getPrismaClient();
  const submissions = await (tx ?? prisma).submission.findMany({
    skip,
    take,
    where: buildListingWhere(siteId, collectionName, status, kind, opts?.extras),
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
      return { ...versions[0], submission } as RowDBO;
    });
}

export async function dbListLatestPublishedSubmissions(
  ctx: SiteContext,
  extensions: ClientExtension[],
  where?: {
    collection?: string;
    kind?: string;
    status?: string;
    q?: string;
    from?: string;
    to?: string;
  },
  opts?: { page?: number; limit?: number; sort?: WorksSort },
): Promise<ListDBO | undefined> {
  // only allow lookup on status if collection is also provided
  // and limit to allowed statuses for now
  const status: string = where?.status === 'in-review' ? 'IN_REVIEW' : 'PUBLISHED';
  if (status !== 'PUBLISHED' && !where?.collection) {
    throw httpError(
      400,
      'Can only filter by a status other than "published" when also filtering by collection',
    );
  }

  // Search narrows to a pre-resolved id set via raw SQL (covers the authors
  // text[] substring match Prisma can't express); the select/count then run
  // through the shared Prisma filter. An empty match short-circuits.
  let searchIds: string[] | undefined;
  if (where?.q) {
    searchIds = await dbSearchSubmissionIds(ctx.site.id, where.q);
    if (searchIds.length === 0) {
      return { items: [], total: 0 };
    }
  }
  const extras: ListingExtras = { from: where?.from, to: where?.to, ids: searchIds };
  const queryOpts = { ...opts, extras };

  const workflows = getWorkflows(ctx.$config, registerExtensionWorkflows(extensions));
  let collectionName: string | undefined;
  if (where?.collection) {
    // when filtering on collection, we need to first check if the workflow
    // on the collection is visible for the state[status] being queried
    const prisma = await getPrismaClient();
    const collection = await prisma.collection.findFirst({
      where: {
        name: where.collection,
        site: { name: ctx.site.name },
      },
    });

    if (!collection) {
      return { items: [], total: 0 };
    } else {
      const workflow = workflows[collection.workflow];
      if (workflow.states[status].visible) {
        collectionName = collection.name;
      } else {
        return { items: [], total: 0 };
      }
    }
  }

  if (isOffsetPaginationRequested(opts ?? {})) {
    const [items, total] = await Promise.all([
      dbQuerySubmissions(ctx.site.id, collectionName, status, where?.kind, queryOpts),
      dbCountSubmissions(ctx.site.id, collectionName, status, where?.kind, extras),
    ]);
    return { items, total };
  }

  // no pagination if limit and page are not provided
  // we can still limit, but in this branch we avoid
  // the extra count query
  if (opts?.page === undefined) {
    const items = await dbQuerySubmissions(
      ctx.site.id,
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
 * List the latest published (or in-review, when scoped to a collection)
 * submission version per submission for a site, formatted as a
 * SiteWorkListingDTO.
 */
export async function listPublishedWorks(
  ctx: SiteContext,
  extensions: ClientExtension[],
  where?: {
    collection?: string;
    kind?: string;
    status?: string;
    q?: string;
    from?: string;
    to?: string;
  },
  opts?: { page?: number; limit?: number; sort?: WorksSort },
) {
  const dbo = await dbListLatestPublishedSubmissions(ctx, extensions, where, opts);
  if (!dbo) throw error404();
  return formatSiteWorkDTOFromSubmissions(ctx, dbo, where, opts);
}
