import {
  getPrismaClient,
  fetchWorkVersionSubjects,
  fetchSubmissionIdsBySubject,
  isAffiliationSearchEnabled,
  WORK_VERSION_AFFILIATIONS_SEARCH_TEXT_FN,
  type SiteContext,
} from '@curvenote/scms-server';
import {
  error404,
  httpError,
  isOffsetPaginationRequested,
  getWorkflows,
  registerExtensionWorkflows,
  type ClientExtension,
} from '@curvenote/scms-core';
import { Prisma } from '@curvenote/scms-db';
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
 * Resolve submission ids matching a free-text `q` by ILIKE-substring across
 * work-version title / authors / DOI, work-level DOI, and (when
 * {@link isAffiliationSearchEnabled} allows) affiliation names in metadata.
 *
 * Roots at `WorkVersion` via a UNION of single-predicate branches so each arm
 * can use its pg_trgm GIN index (`20260526223800`,
 * `20260610120000_add_work_version_affiliations_trgm_index`), then joins back
 * through `SubmissionVersion` to `Submission` scoped by `site_id`. The previous
 * correlated `EXISTS (… WHERE sv.submission_id = s.id …)` looped once per
 * submission on large sites (e.g. biorxiv) and dominated CPU under search load.
 *
 * `immutable_array_to_string(authors, ' ')` and
 * `work_version_affiliations_search_text(metadata)` MUST match their expression
 * indexes exactly for the planner to use them.
 */
async function dbSearchSubmissionIds(
  siteId: string,
  q: string,
  tx?: Prisma.TransactionClient,
): Promise<string[]> {
  const prisma = await getPrismaClient();
  const pattern = `%${escapeIlikePattern(q)}%`;
  const matchingWorkVersionBranches: Prisma.Sql[] = [
    Prisma.sql`SELECT wv.id FROM "WorkVersion" wv WHERE wv.title ILIKE ${pattern}`,
    Prisma.sql`SELECT wv.id FROM "WorkVersion" wv WHERE wv.doi ILIKE ${pattern}`,
    Prisma.sql`SELECT wv.id FROM "WorkVersion" wv WHERE immutable_array_to_string(wv.authors, ' ') ILIKE ${pattern}`,
    Prisma.sql`
      SELECT wv.id
      FROM "WorkVersion" wv
      INNER JOIN "Work" w ON w.id = wv.work_id
      WHERE w.doi ILIKE ${pattern}
    `,
  ];
  if (isAffiliationSearchEnabled(q)) {
    matchingWorkVersionBranches.push(
      Prisma.sql`
        SELECT wv.id
        FROM "WorkVersion" wv
        WHERE ${Prisma.raw(WORK_VERSION_AFFILIATIONS_SEARCH_TEXT_FN)}(wv.metadata) ILIKE ${pattern}
      `,
    );
  }
  const matchingWorkVersions = Prisma.join(matchingWorkVersionBranches, ' UNION ');
  const rows = await (tx ?? prisma).$queryRaw<{ id: string }[]>`
    SELECT DISTINCT s.id
    FROM (${matchingWorkVersions}) matching_wv
    INNER JOIN "SubmissionVersion" sv ON sv.work_version_id = matching_wv.id
    INNER JOIN "Submission" s ON s.id = sv.submission_id AND s.site_id = ${siteId}
  `;
  return rows.map((r) => r.id);
}

/**
 * Count submissions that have at least one version in the requested status.
 *
 * Uses a single `COUNT(DISTINCT s.id)` over an inner join to
 * `SubmissionVersion` rather than Prisma's correlated `EXISTS` wrapper (which
 * showed up in logs as a slow `COUNT(*)` subquery over every site submission
 * on large sites). Optional collection / kind / date / search-id filters mirror
 * {@link buildListingWhere}.
 */
async function dbCountSubmissions(
  siteId: string,
  collectionName: string | undefined,
  status: string,
  kind?: string,
  extras?: ListingExtras,
  tx?: Prisma.TransactionClient,
): Promise<number> {
  const prisma = await getPrismaClient();
  const joins: Prisma.Sql[] = [
    Prisma.sql`
      INNER JOIN "SubmissionVersion" sv
        ON sv.submission_id = s.id
       AND sv.status = ${status}
    `,
  ];
  const conditions: Prisma.Sql[] = [Prisma.sql`s.site_id = ${siteId}`];

  if (collectionName) {
    joins.push(Prisma.sql`INNER JOIN "Collection" c ON c.id = s.collection_id`);
    conditions.push(Prisma.sql`c.name = ${collectionName}`);
  }
  if (kind) {
    joins.push(Prisma.sql`INNER JOIN "SubmissionKind" k ON k.id = s.kind_id`);
    conditions.push(Prisma.sql`k.name = ${kind}`);
  }

  const toExclusive = extras?.to ? toExclusiveDateUpperBound(extras.to) : undefined;
  if (extras?.from) {
    conditions.push(Prisma.sql`s.date_published >= ${extras.from}`);
  }
  if (toExclusive) {
    conditions.push(Prisma.sql`s.date_published < ${toExclusive}`);
  }
  if (extras?.ids) {
    conditions.push(Prisma.sql`s.id IN (${Prisma.join(extras.ids)})`);
  }

  const [{ count }] = await (tx ?? prisma).$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT s.id) AS count
    FROM "Submission" s
    ${Prisma.join(joins, ' ')}
    WHERE ${Prisma.join(conditions, ' AND ')}
  `;
  return Number(count);
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
    subject?: string;
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

  // Search and subject filters narrow to pre-resolved id sets via raw SQL; the
  // select/count then run through the shared Prisma filter. An empty intersection
  // short-circuits.
  let searchIds: string[] | undefined;
  if (where?.q) {
    searchIds = await dbSearchSubmissionIds(ctx.site.id, where.q);
  }
  let subjectIds: string[] | undefined;
  if (where?.subject) {
    subjectIds = await fetchSubmissionIdsBySubject(ctx.site.id, where.subject, status);
  }
  const filteredIds = intersectSubmissionIds(searchIds, subjectIds);
  if (filteredIds?.length === 0) {
    return { items: [], total: 0 };
  }
  const extras: ListingExtras = { from: where?.from, to: where?.to, ids: filteredIds };
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
    subject?: string;
    from?: string;
    to?: string;
  },
  opts?: { page?: number; limit?: number; sort?: WorksSort },
) {
  const dbo = await dbListLatestPublishedSubmissions(ctx, extensions, where, opts);
  if (!dbo) throw error404();
  const subjects = await fetchWorkVersionSubjects(dbo.items.map((row) => row.work_version.id));
  return formatSiteWorkDTOFromSubmissions(ctx, dbo, where, { ...opts, subjects });
}
