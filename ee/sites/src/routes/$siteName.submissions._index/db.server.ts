import type { SiteContext } from '@curvenote/scms-server';
import { getPrismaClient } from '@curvenote/scms-server';
import { Prisma } from '@curvenote/scms-db';
import { dbLoadIndexVersionDates, firstVersionTag } from './index.versions.server.js';
import { toExclusiveDateUpperBound, type ListingQuery } from './listingParams.js';

/**
 * Route-local data access for the new submissions index listing.
 *
 * Everything here relies on the denormalised `Submission.is_listed` flag,
 * maintained by the Postgres trigger function `submission_recompute_listing_fields`
 * (see migration `20260526120000_add_submission_is_listed`). The flag is true
 * iff the submission has at least one version and no version is in DRAFT
 * or INCOMPLETE status — i.e. it is the legacy "signed" predicate, expressed
 * as a single indexable column.
 *
 * Two execution paths, sharing the same WHERE / ORDER BY composition:
 *
 *  - Fast path (no `q`): `prisma.submission.findMany` served by the partial
 *    index `Submission_is_listed_listing_idx (site_id, date_published DESC,
 *    date_created DESC) WHERE is_listed = TRUE`. Both list and count are
 *    direct index scans.
 *
 *  - Search path (`q` set): a single raw SQL query joins
 *    `Submission` -> `SubmissionVersion` -> `WorkVersion` (LEFT JOIN `Work`)
 *    via EXISTS and matches with ILIKE substrings across title / authors /
 *    DOI. The pg_trgm GIN indexes from migration
 *    `20260526223800_add_submission_search_trgm_indexes` (on
 *    `WorkVersion.title`, `WorkVersion.doi`, `Work.doi`, and the expression
 *    `immutable_array_to_string(WorkVersion.authors, ' ')`) let Postgres serve
 *    those predicates without a seqscan. The raw query returns matching submission
 *    ids; we rehydrate via `findMany({ where: { id: { in: ids } } })` so the
 *    select shape is identical to the fast path. Order is re-applied client
 *    side to preserve the raw query's ORDER BY.
 *
 * Filters (kindIds, collectionIds, statuses, date range, unpublishedOnly)
 * and sort (recent_published, recent_created) flow through the four
 * composable builders below and apply to both paths.
 *
 * Date filter semantics: the `from` / `to` window applies strictly to
 * `Submission.date_published`. Rows with NULL `date_published` are excluded
 * when any window is active. The `unpublishedOnly` flag is the dedicated way
 * to surface those rows — when set, the window is ignored and the predicate
 * becomes `date_published IS NULL`. Both modes are mutually exclusive and the
 * UI enforces that by clearing the inactive params when the user switches.
 *
 * The `statuses` filter currently runs through a correlated subquery against
 * the newest `SubmissionVersion`, so any active status filter forces the raw
 * SQL path even when `q` is empty. This is intentional until the
 * denormalisation slice lands a cached `active_status` column on `Submission`,
 * after which the filter moves into `buildListingPrismaWhere` and the fast
 * path takes over.
 *
 * --- Next slice (denormalisation extension) ---
 *
 * The `submission_recompute_listing_fields` trigger was named generically so
 * the next slice can extend it to maintain a handful of additional cached
 * columns on `Submission`, without introducing new triggers:
 *
 *   active_status        — the newest version's status; allows the status
 *                          filter to leave the raw SQL path.
 *   last_activity_at     — max(Activity.date_created) for the submission;
 *                          unlocks the `recent_activity` sort.
 *
 * For each sort, the relevant builder switch below throws (currently
 * unreachable because `ListingQuerySchema` in `route.tsx` coerces disabled
 * sorts to the default). Once the column lands, flip the throw to the new
 * ORDER BY clause.
 *
 * This file imports nothing from `submissions-classic`.
 */

type WorkVersionMinimal = {
  title: string;
  authors: string[];
  doi: string | null;
};

export type IndexListingRow = {
  id: string;
  date_created: string;
  date_published: string | null;
  work: { doi: string | null } | null;
  kind: { id: string; name: string; content: Prisma.JsonValue };
  collection: {
    id: string;
    name: string;
    slug: string;
    open: boolean;
    content: Prisma.JsonValue;
    workflow: string;
  };
  versions: {
    status: string;
    tags: string[];
    work_version: WorkVersionMinimal;
  }[];
  publishedVersion?: { date_created: string };
  retractedVersion?: { date_created: string };
  versionTag?: string;
  activity: { date_created: string }[];
};

/**
 * The shared select shape used by both the fast path (direct findMany)
 * and the search path (rehydration findMany). Keep both paths producing
 * identical row shapes so `formatSubmissionsIndexItems` stays unaware of
 * which path served it.
 */
const INDEX_LISTING_SELECT = {
  id: true,
  date_created: true,
  date_published: true,
  work: { select: { doi: true } },
  kind: { select: { id: true, name: true, content: true } },
  collection: {
    select: {
      id: true,
      name: true,
      slug: true,
      open: true,
      content: true,
      workflow: true,
    },
  },
  versions: {
    take: 1,
    orderBy: { date_created: 'desc' },
    select: {
      status: true,
      tags: true,
      work_version: { select: { title: true, authors: true, doi: true } },
    },
  },
  activity: {
    take: 1,
    orderBy: { date_created: 'desc' },
    select: { date_created: true },
  },
} satisfies Prisma.SubmissionSelect;

/* -----------------------------------------------------------------------------
 * Path selection
 * -------------------------------------------------------------------------- */

function needsRawSqlPath(query: ListingQuery): boolean {
  // `q` (search) joins SubmissionVersion -> WorkVersion and `statuses` runs a
  // correlated subquery against the newest SubmissionVersion. Prisma can't
  // express either efficiently, so both force the raw SQL path. The remaining
  // filters (kindIds, collectionIds, date range) and the supported sorts live
  // on `Submission` directly.
  return Boolean(query.q) || query.statuses.length > 0;
}

/* -----------------------------------------------------------------------------
 * WHERE / ORDER BY builders (composable, dual-path)
 * -------------------------------------------------------------------------- */

function buildListingPrismaWhere(siteId: string, query: ListingQuery): Prisma.SubmissionWhereInput {
  const where: Prisma.SubmissionWhereInput = {
    site_id: siteId,
    is_listed: true,
  };
  if (query.kindIds.length) {
    where.kind_id = { in: query.kindIds };
  }
  if (query.collectionIds.length) {
    where.collection_id = { in: query.collectionIds };
  }
  if (query.unpublishedOnly) {
    // `date_published IS NULL` filter — `from` / `to` are intentionally
    // ignored. The UI enforces that the two modes never co-exist, but we
    // also drop the range here so a hand-crafted URL like
    // `?unpublishedOnly=1&from=2024-01-01` still produces a coherent query.
    where.date_published = null;
  } else {
    const fromIso = query.from;
    const toExclusive = query.to ? toExclusiveDateUpperBound(query.to) : undefined;
    if (fromIso || toExclusive) {
      // Strict window against date_published. NULL `date_published` rows
      // fail the `gte` / `lt` comparison in Prisma's nullable filter and are
      // therefore excluded — that is the intended new semantics. Matches the
      // raw SQL builder.
      const publishedFilter: Prisma.StringNullableFilter = {};
      if (fromIso) publishedFilter.gte = fromIso;
      if (toExclusive) publishedFilter.lt = toExclusive;
      where.date_published = publishedFilter;
    }
  }
  return where;
}

function buildListingPrismaOrderBy(
  query: ListingQuery,
): Prisma.SubmissionOrderByWithRelationInput[] {
  // Every sort appends `{ id: 'asc' }` as the final tie-breaker so LIMIT/OFFSET
  // pagination is deterministic across separate queries — without it, rows that
  // tie on the leading sort keys (common after bulk imports / bulk publishes)
  // can shift between pages, producing duplicates or holes as users scroll.
  // Mirrors the raw SQL path, which already pins `s.id ASC` last.
  switch (query.sort) {
    case 'recent_published':
      return [{ date_published: 'desc' }, { date_created: 'desc' }, { id: 'asc' }];
    case 'recent_created':
      return [{ date_created: 'desc' }, { id: 'asc' }];
    case 'recent_activity':
      // Unreachable: ListingQuerySchema coerces this to the default until the
      // denormalisation slice lands. Throw loudly so a future regression that
      // exposes this sort fails in tests instead of producing a silent
      // Prisma error.
      throw new Error(
        `buildListingPrismaOrderBy: sort '${query.sort}' awaits denormalisation slice`,
      );
  }
}

function buildListingRawSqlWhere(siteId: string, query: ListingQuery): Prisma.Sql {
  const conds: Prisma.Sql[] = [Prisma.sql`s.site_id = ${siteId}`, Prisma.sql`s.is_listed = TRUE`];
  if (query.kindIds.length) {
    conds.push(Prisma.sql`s.kind_id IN (${Prisma.join(query.kindIds)})`);
  }
  if (query.collectionIds.length) {
    conds.push(Prisma.sql`s.collection_id IN (${Prisma.join(query.collectionIds)})`);
  }
  if (query.unpublishedOnly) {
    conds.push(Prisma.sql`s.date_published IS NULL`);
  } else {
    const fromIso = query.from;
    const toExclusive = query.to ? toExclusiveDateUpperBound(query.to) : undefined;
    // Postgres three-valued logic already excludes NULL `date_published`
    // from these comparisons, so no explicit `IS NOT NULL` guard is needed.
    if (fromIso && toExclusive) {
      conds.push(Prisma.sql`s.date_published >= ${fromIso} AND s.date_published < ${toExclusive}`);
    } else if (fromIso) {
      conds.push(Prisma.sql`s.date_published >= ${fromIso}`);
    } else if (toExclusive) {
      conds.push(Prisma.sql`s.date_published < ${toExclusive}`);
    }
  }
  if (query.statuses.length) {
    // Correlated subquery against the newest version. Matches the listing
    // card semantics in `format.server.ts` (newest version's status), and
    // returns NULL — i.e. fails the IN check — for submissions with no
    // versions. The `is_listed = TRUE` predicate above guarantees there is
    // at least one version, but we keep the subquery safe regardless.
    conds.push(Prisma.sql`(
      SELECT sv.status FROM "SubmissionVersion" sv
      WHERE sv.submission_id = s.id
      ORDER BY sv.date_created DESC
      LIMIT 1
    ) IN (${Prisma.join(query.statuses)})`);
  }
  if (query.q) {
    // Substring match across the newest version's title / authors / DOI and
    // the underlying work's DOI. Searches all versions of the submission, not
    // just the newest one — a hit on any version surfaces the submission.
    //
    // `immutable_array_to_string(authors, ' ')` MUST exactly match the
    // expression index in the trigram migration for the planner to use it.
    // The wrapper exists because the built-in `array_to_string` is STABLE
    // (so it can't be used in a functional index); see the migration header
    // for the full rationale.
    //
    // `%` and `_` typed by the user are passed through to ILIKE on purpose,
    // exposed in the search box help popover. Only the escape character `\`
    // itself is escaped so a user-supplied backslash matches literally.
    const pattern = `%${escapeIlikePattern(query.q)}%`;
    conds.push(Prisma.sql`EXISTS (
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
    )`);
  }
  return Prisma.join(conds, ' AND ');
}

function buildListingRawSqlOrderBy(query: ListingQuery): Prisma.Sql {
  switch (query.sort) {
    case 'recent_published':
      // Preserve fast-path semantics: default NULLS FIRST (Postgres DESC default).
      return Prisma.sql`s.date_published DESC, s.date_created DESC, s.id ASC`;
    case 'recent_created':
      return Prisma.sql`s.date_created DESC, s.id ASC`;
    case 'recent_activity':
      throw new Error(
        `buildListingRawSqlOrderBy: sort '${query.sort}' awaits denormalisation slice`,
      );
  }
}

/**
 * Escape only the ILIKE escape character itself (`\`) so a user-supplied
 * backslash matches literally. `%` and `_` are intentionally passed through
 * to Postgres — the help popover next to the search box documents that they
 * act as ILIKE wildcards (any sequence / any single character respectively).
 */
function escapeIlikePattern(q: string): string {
  return q.replace(/\\/g, '\\\\');
}

/* -----------------------------------------------------------------------------
 * Public API
 * -------------------------------------------------------------------------- */

export async function dbCountSubmissionsForIndex(
  ctx: SiteContext,
  query: ListingQuery,
): Promise<number> {
  const prisma = await getPrismaClient();
  if (!needsRawSqlPath(query)) {
    return prisma.submission.count({ where: buildListingPrismaWhere(ctx.site.id, query) });
  }
  const where = buildListingRawSqlWhere(ctx.site.id, query);
  const result = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count FROM "Submission" s WHERE ${where}
  `;
  return Number(result[0]?.count ?? 0);
}

export async function dbListSubmissionsForIndex(
  ctx: SiteContext,
  query: ListingQuery,
): Promise<IndexListingRow[]> {
  const prisma = await getPrismaClient();
  const { page, perPage } = query;
  const skip = (page - 1) * perPage;

  let rows: Awaited<ReturnType<typeof loadRowsByIds>>;

  if (!needsRawSqlPath(query)) {
    rows = await prisma.submission.findMany({
      where: buildListingPrismaWhere(ctx.site.id, query),
      orderBy: buildListingPrismaOrderBy(query),
      skip,
      take: perPage,
      select: INDEX_LISTING_SELECT,
    });
  } else {
    const where = buildListingRawSqlWhere(ctx.site.id, query);
    const orderBy = buildListingRawSqlOrderBy(query);
    const idRows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT s.id FROM "Submission" s
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT ${perPage} OFFSET ${skip}
    `;
    rows = await loadRowsByIds(idRows.map((r) => r.id));
  }

  const versionDates = await dbLoadIndexVersionDates(rows.map((row) => row.id));

  return rows.map((row) => {
    const dates = versionDates.get(row.id);
    const newestVersion = row.versions[0];
    return {
      ...row,
      publishedVersion: dates?.publishedVersion,
      retractedVersion: dates?.retractedVersion,
      versionTag: newestVersion ? firstVersionTag(newestVersion) : undefined,
    };
  });
}

/** Rehydrate the shared row shape for ids returned by the raw SQL search path. */
async function loadRowsByIds(orderedIds: string[]) {
  if (orderedIds.length === 0) return [];
  const prisma = await getPrismaClient();
  const unordered = await prisma.submission.findMany({
    where: { id: { in: orderedIds } },
    select: INDEX_LISTING_SELECT,
  });
  const byId = new Map(unordered.map((row) => [row.id, row]));
  return orderedIds
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}
