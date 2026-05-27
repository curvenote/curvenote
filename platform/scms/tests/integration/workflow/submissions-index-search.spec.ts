/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, beforeEach } from 'vitest';
import type { SiteRole } from '@curvenote/scms-db';
import { getPrismaClient } from '@curvenote/scms-server';
import { uuidv7 } from 'uuidv7';
import { createTestData, type TestData } from '../helpers/mocks';

import {
  dbCountSubmissionsForIndex,
  dbListSubmissionsForIndex,
} from '../../../../../ee/sites/src/routes/$siteName.submissions._index/db.server';
import type { ListingQuery } from '../../../../../ee/sites/src/routes/$siteName.submissions._index/listingParams';

/**
 * End-to-end coverage for the `$siteName.submissions._index` data layer.
 *
 * Exercises:
 *
 *  - empty-q parity between the Prisma fast path and the raw-SQL search path
 *    (same input filters, same id set & count)
 *  - title / author / DOI substring matches, case-insensitive
 *  - special-character safety (`%`, `_` typed by the user are matched literally)
 *  - pagination interaction (page bounds, perPage)
 *  - kindIds, collectionIds, date-range filters (strict on `date_published`)
 *  - `unpublishedOnly` mode (rows where `date_published IS NULL`); mutually
 *    exclusive with the range filter
 *  - sort=recent_published vs recent_created
 *  - combined q + filters
 *
 * The pg_trgm indexes referenced by the search path live in migration
 * `20260526223800_add_submission_search_trgm_indexes`. If those indexes are
 * missing the tests still pass (the query just degrades to a seqscan) — but
 * `EXPLAIN ANALYZE` on the search query in a populated DB should show a
 * bitmap index scan over the trigram indexes.
 */

const DEFAULT_QUERY: ListingQuery = {
  page: 1,
  perPage: 100,
  sort: 'recent_published',
  kindIds: [],
  collectionIds: [],
  statuses: [],
  unpublishedOnly: false,
};

describe('submissions index — search and filters', () => {
  let testData: TestData;

  // Created in beforeEach, shared by every test.
  type SeedSubmission = {
    id: string;
    title: string;
    authors: string[];
    workDoi: string | null;
    workVersionDoi: string | null;
    kindId: string;
    collectionId: string;
    datePublished: string | null;
    dateCreated: string;
  };

  let seed: {
    altKindId: string;
    altCollectionId: string;
    submissions: Record<string, SeedSubmission>;
  };

  beforeEach(async () => {
    testData = await createTestData('ADMIN' as SiteRole);
    seed = await seedSubmissions(testData);
  });

  /* -------------------------------------------------------------------------
   * Empty-q path (fast path / Prisma)
   * ---------------------------------------------------------------------- */

  test('with no filters returns every listed submission in the site', async () => {
    const total = await dbCountSubmissionsForIndex(testData.context, DEFAULT_QUERY);
    const rows = await dbListSubmissionsForIndex(testData.context, DEFAULT_QUERY);
    expect(total).toBe(Object.keys(seed.submissions).length);
    expect(rows.map((r) => r.id).sort()).toEqual(
      Object.values(seed.submissions)
        .map((s) => s.id)
        .sort(),
    );
  });

  test('respects kindIds filter', async () => {
    const query: ListingQuery = { ...DEFAULT_QUERY, kindIds: [seed.altKindId] };
    const rows = await dbListSubmissionsForIndex(testData.context, query);
    const total = await dbCountSubmissionsForIndex(testData.context, query);
    const expected = Object.values(seed.submissions)
      .filter((s) => s.kindId === seed.altKindId)
      .map((s) => s.id);
    expect(total).toBe(expected.length);
    expect(rows.map((r) => r.id).sort()).toEqual(expected.sort());
  });

  test('respects collectionIds filter', async () => {
    const query: ListingQuery = {
      ...DEFAULT_QUERY,
      collectionIds: [seed.altCollectionId],
    };
    const rows = await dbListSubmissionsForIndex(testData.context, query);
    const expected = Object.values(seed.submissions)
      .filter((s) => s.collectionId === seed.altCollectionId)
      .map((s) => s.id);
    expect(rows.map((r) => r.id).sort()).toEqual(expected.sort());
  });

  test('respects date range on date_published', async () => {
    const query: ListingQuery = {
      ...DEFAULT_QUERY,
      from: '2024-01-01',
      to: '2024-01-31',
    };
    const rows = await dbListSubmissionsForIndex(testData.context, query);
    expect(rows.map((r) => r.id)).toContain(seed.submissions.photoSynthesis.id);
    expect(rows.map((r) => r.id)).not.toContain(seed.submissions.weatherRadar.id);
  });

  test('date range excludes rows with NULL date_published (strict semantics)', async () => {
    // unpublishedAlgo has date_published = null, date_created = '2024-01-10'.
    // Under the old fallback rules this row was returned by a January window;
    // the new strict semantics filter exclusively on date_published, so it
    // must NOT appear in the result.
    const query: ListingQuery = {
      ...DEFAULT_QUERY,
      from: '2024-01-01',
      to: '2024-01-31',
    };
    const rows = await dbListSubmissionsForIndex(testData.context, query);
    expect(rows.map((r) => r.id)).not.toContain(seed.submissions.unpublishedAlgo.id);
  });

  test('unpublishedOnly returns only rows where date_published IS NULL', async () => {
    const query: ListingQuery = { ...DEFAULT_QUERY, unpublishedOnly: true };
    const rows = await dbListSubmissionsForIndex(testData.context, query);
    const total = await dbCountSubmissionsForIndex(testData.context, query);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(seed.submissions.unpublishedAlgo.id);
    expect(ids).not.toContain(seed.submissions.photoSynthesis.id);
    expect(ids).not.toContain(seed.submissions.brontePoetry.id);
    expect(ids).not.toContain(seed.submissions.weatherRadar.id);
    expect(ids).not.toContain(seed.submissions.altCollectionSubmission.id);
    expect(ids).not.toContain(seed.submissions.workOnlyDoi.id);
    expect(total).toBe(ids.length);
    // Every returned row must have a null date_published.
    for (const row of rows) expect(row.date_published).toBeNull();
  });

  test('unpublishedOnly ignores any from/to that happen to be set', async () => {
    // Defense-in-depth — the UI clears `from` / `to` when flipping into
    // unpublishedOnly mode, but a hand-crafted URL might still carry a stale
    // window. The loader must drop the range and stick to the NULL predicate.
    const query: ListingQuery = {
      ...DEFAULT_QUERY,
      unpublishedOnly: true,
      from: '1999-01-01',
      to: '1999-12-31',
    };
    const rows = await dbListSubmissionsForIndex(testData.context, query);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(seed.submissions.unpublishedAlgo.id);
    for (const row of rows) expect(row.date_published).toBeNull();
  });

  test('sort=recent_published orders by date_published desc', async () => {
    const rows = await dbListSubmissionsForIndex(testData.context, DEFAULT_QUERY);
    const dates = rows.map((r) => r.date_published).filter((d): d is string => d !== null);
    const sorted = [...dates].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    expect(dates).toEqual(sorted);
  });

  test('sort=recent_created orders by date_created desc', async () => {
    const rows = await dbListSubmissionsForIndex(testData.context, {
      ...DEFAULT_QUERY,
      sort: 'recent_created',
    });
    const dates = rows.map((r) => r.date_created);
    const sorted = [...dates].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    expect(dates).toEqual(sorted);
  });

  /* -------------------------------------------------------------------------
   * Status filter (correlated subquery in raw SQL path)
   * ---------------------------------------------------------------------- */

  test('statuses=[PENDING] returns only rows whose newest version is PENDING', async () => {
    const query: ListingQuery = { ...DEFAULT_QUERY, statuses: ['PENDING'] };
    const rows = await dbListSubmissionsForIndex(testData.context, query);
    const total = await dbCountSubmissionsForIndex(testData.context, query);
    const ids = rows.map((r) => r.id);
    expect(ids).toEqual([seed.submissions.brontePoetry.id]);
    expect(total).toBe(1);
  });

  test('statuses=[APPROVED,PUBLISHED] is the union of both', async () => {
    const query: ListingQuery = { ...DEFAULT_QUERY, statuses: ['APPROVED', 'PUBLISHED'] };
    const rows = await dbListSubmissionsForIndex(testData.context, query);
    const ids = new Set(rows.map((r) => r.id));
    expect(ids.has(seed.submissions.photoSynthesis.id)).toBe(true); // APPROVED
    expect(ids.has(seed.submissions.weatherRadar.id)).toBe(true); // APPROVED
    expect(ids.has(seed.submissions.unpublishedAlgo.id)).toBe(true); // APPROVED
    expect(ids.has(seed.submissions.workOnlyDoi.id)).toBe(true); // PUBLISHED
    expect(ids.has(seed.submissions.brontePoetry.id)).toBe(false); // PENDING
    expect(ids.has(seed.submissions.altCollectionSubmission.id)).toBe(false); // REJECTED
  });

  test('statuses=[RETRACTED] yields no rows when none are seeded', async () => {
    const query: ListingQuery = { ...DEFAULT_QUERY, statuses: ['RETRACTED'] };
    const rows = await dbListSubmissionsForIndex(testData.context, query);
    const total = await dbCountSubmissionsForIndex(testData.context, query);
    expect(rows).toEqual([]);
    expect(total).toBe(0);
  });

  test('statuses honours the *newest* version when an older version differs', async () => {
    // Seed a submission where the older version is PENDING and the newer is
    // PUBLISHED. The status filter must match PUBLISHED (newest), not PENDING.
    const prisma = await getPrismaClient();
    const id = await createListedSubmission(testData, {
      title: 'Versioned status check',
      authors: ['Status, Versioned'],
      workDoi: null,
      workVersionDoi: null,
      kindId: testData.kindId,
      collectionId: testData.collectionId,
      datePublished: '2025-07-01',
      status: 'PENDING',
    });
    // Add a newer SubmissionVersion (same submission) with PUBLISHED status.
    const newerWorkVersion = await prisma.workVersion.findFirst({
      where: { work: { submissions: { some: { id } } } },
    });
    if (!newerWorkVersion) throw new Error('seed: no work_version for new submission');
    await prisma.submissionVersion.create({
      data: {
        id: uuidv7(),
        date_created: new Date(Date.now() + 1000).toISOString(),
        date_modified: new Date(Date.now() + 1000).toISOString(),
        status: 'PUBLISHED',
        submission: { connect: { id } },
        work_version: { connect: { id: newerWorkVersion.id } },
        submitted_by: { connect: { id: testData.userId } },
      },
    });

    const published = await dbListSubmissionsForIndex(testData.context, {
      ...DEFAULT_QUERY,
      statuses: ['PUBLISHED'],
    });
    expect(published.map((r) => r.id)).toContain(id);

    const pending = await dbListSubmissionsForIndex(testData.context, {
      ...DEFAULT_QUERY,
      statuses: ['PENDING'],
    });
    expect(pending.map((r) => r.id)).not.toContain(id);
  });

  test('statuses combines with kindIds to narrow further', async () => {
    const query: ListingQuery = {
      ...DEFAULT_QUERY,
      statuses: ['APPROVED'],
      kindIds: [seed.altKindId],
    };
    const rows = await dbListSubmissionsForIndex(testData.context, query);
    expect(rows.map((r) => r.id)).toEqual([seed.submissions.weatherRadar.id]);
  });

  test('statuses combines with q to narrow further', async () => {
    const query: ListingQuery = {
      ...DEFAULT_QUERY,
      statuses: ['APPROVED'],
      q: 'photo',
    };
    const rows = await dbListSubmissionsForIndex(testData.context, query);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(seed.submissions.photoSynthesis.id);
    // brontePoetry matches kind/site but is PENDING.
    expect(ids).not.toContain(seed.submissions.brontePoetry.id);
  });

  /* -------------------------------------------------------------------------
   * Search path (raw SQL with pg_trgm)
   * ---------------------------------------------------------------------- */

  test('q matches on title (case-insensitive)', async () => {
    const rows = await dbListSubmissionsForIndex(testData.context, {
      ...DEFAULT_QUERY,
      q: 'PHOTO',
    });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(seed.submissions.photoSynthesis.id);
    expect(ids).not.toContain(seed.submissions.weatherRadar.id);
  });

  test('q matches on author surname', async () => {
    const rows = await dbListSubmissionsForIndex(testData.context, {
      ...DEFAULT_QUERY,
      q: 'Brontë',
    });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(seed.submissions.brontePoetry.id);
    expect(ids).not.toContain(seed.submissions.photoSynthesis.id);
  });

  test('q matches on work_version DOI substring', async () => {
    const rows = await dbListSubmissionsForIndex(testData.context, {
      ...DEFAULT_QUERY,
      q: '10.1234/wv-radar-2024',
    });
    expect(rows.map((r) => r.id)).toContain(seed.submissions.weatherRadar.id);
  });

  test('q matches on work DOI substring (work.doi, not version.doi)', async () => {
    const rows = await dbListSubmissionsForIndex(testData.context, {
      ...DEFAULT_QUERY,
      q: 'work-only-doi',
    });
    expect(rows.map((r) => r.id)).toContain(seed.submissions.workOnlyDoi.id);
  });

  test('q with no matches returns an empty page and count of 0', async () => {
    const rows = await dbListSubmissionsForIndex(testData.context, {
      ...DEFAULT_QUERY,
      q: 'completelyabsentterm123xyz',
    });
    const total = await dbCountSubmissionsForIndex(testData.context, {
      ...DEFAULT_QUERY,
      q: 'completelyabsentterm123xyz',
    });
    expect(rows).toEqual([]);
    expect(total).toBe(0);
  });

  test('q exposes `%` as an ILIKE "any sequence" wildcard', async () => {
    // "Photo%synthesis" should match "Photosynthesis" (the `%` collapses
    // through the trailing "s" of "Photo" into the start of "synthesis").
    const rows = await dbListSubmissionsForIndex(testData.context, {
      ...DEFAULT_QUERY,
      q: 'Photo%synthesis',
    });
    expect(rows.map((r) => r.id)).toContain(seed.submissions.photoSynthesis.id);
    // And a `%` between unrelated terms still narrows.
    const noMatch = await dbListSubmissionsForIndex(testData.context, {
      ...DEFAULT_QUERY,
      q: 'Photo%radar',
    });
    expect(noMatch.map((r) => r.id)).not.toContain(seed.submissions.photoSynthesis.id);
  });

  test('q exposes `_` as an ILIKE "any single character" wildcard', async () => {
    // "Phot_synthesis" matches "Photosynthesis" (the `_` covers the "o").
    const rows = await dbListSubmissionsForIndex(testData.context, {
      ...DEFAULT_QUERY,
      q: 'Phot_synthesis',
    });
    expect(rows.map((r) => r.id)).toContain(seed.submissions.photoSynthesis.id);
    // Two underscores cannot bridge a longer gap.
    const noMatch = await dbListSubmissionsForIndex(testData.context, {
      ...DEFAULT_QUERY,
      q: 'P__synthesis',
    });
    expect(noMatch.map((r) => r.id)).not.toContain(seed.submissions.photoSynthesis.id);
  });

  test('q escapes a user-supplied backslash so it matches literally', async () => {
    // We only escape `\` itself; the trailing characters remain wildcards.
    // The query "Photo\synthesis" must not surface "Photosynthesis" since
    // no row actually contains a literal backslash.
    const rows = await dbListSubmissionsForIndex(testData.context, {
      ...DEFAULT_QUERY,
      q: 'Photo\\synthesis',
    });
    expect(rows.map((r) => r.id)).not.toContain(seed.submissions.photoSynthesis.id);
  });

  test('pagination with search returns disjoint pages whose union covers the matches', async () => {
    // Insert a small batch of submissions sharing the term "paginationsearch".
    const batchIds: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const id = await createListedSubmission(testData, {
        title: `Pagination search candidate ${i.toString().padStart(2, '0')}`,
        authors: ['Test, Author'],
        workDoi: null,
        workVersionDoi: null,
        kindId: testData.kindId,
        collectionId: testData.collectionId,
        datePublished: `2025-06-${(i + 1).toString().padStart(2, '0')}`,
      });
      batchIds.push(id);
    }

    const page1 = await dbListSubmissionsForIndex(testData.context, {
      ...DEFAULT_QUERY,
      q: 'paginationsearch',
      page: 1,
      perPage: 2,
    });
    const page2 = await dbListSubmissionsForIndex(testData.context, {
      ...DEFAULT_QUERY,
      q: 'paginationsearch',
      page: 2,
      perPage: 2,
    });
    const page3 = await dbListSubmissionsForIndex(testData.context, {
      ...DEFAULT_QUERY,
      q: 'paginationsearch',
      page: 3,
      perPage: 2,
    });
    const total = await dbCountSubmissionsForIndex(testData.context, {
      ...DEFAULT_QUERY,
      q: 'paginationsearch',
      page: 1,
      perPage: 2,
    });

    expect(total).toBe(batchIds.length);
    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
    expect(page3).toHaveLength(1);
    const seen = new Set([...page1, ...page2, ...page3].map((r) => r.id));
    expect(seen.size).toBe(batchIds.length);
    for (const id of batchIds) expect(seen.has(id)).toBe(true);
  });

  test('combined q + kindIds + date range narrows results', async () => {
    const query: ListingQuery = {
      ...DEFAULT_QUERY,
      q: 'photo',
      kindIds: [testData.kindId],
      from: '2024-01-01',
      to: '2024-01-31',
    };
    const rows = await dbListSubmissionsForIndex(testData.context, query);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(seed.submissions.photoSynthesis.id);
    // brontePoetry is in default kind but doesn't match `photo`.
    expect(ids).not.toContain(seed.submissions.brontePoetry.id);
    // weatherRadar matches kind & date but not title.
    expect(ids).not.toContain(seed.submissions.weatherRadar.id);
  });

  test('count + list agree on the same query', async () => {
    const query: ListingQuery = { ...DEFAULT_QUERY, q: 'photo' };
    const rows = await dbListSubmissionsForIndex(testData.context, query);
    const total = await dbCountSubmissionsForIndex(testData.context, query);
    expect(rows.length).toBe(total);
  });
});

/* ---------------------------------------------------------------------------
 * Seeding helpers
 * ------------------------------------------------------------------------ */

interface CreateListedSubmissionParams {
  title: string;
  authors: string[];
  workDoi: string | null;
  workVersionDoi: string | null;
  kindId: string;
  collectionId: string;
  datePublished?: string | null;
  /**
   * Status of the (newest, single) SubmissionVersion. The status-filter
   * predicate matches against the newest version's status, so this is what
   * the `statuses` filter sees. Defaults to APPROVED — any non-DRAFT,
   * non-INCOMPLETE value flips `is_listed = true` via the recompute trigger.
   */
  status?: string;
}

/**
 * Creates a Work + WorkVersion + Submission + SubmissionVersion (status
 * "APPROVED" by default) so the trigger marks the Submission as
 * `is_listed = true`. Returns the submission id.
 */
async function createListedSubmission(
  testData: TestData,
  params: CreateListedSubmissionParams,
): Promise<string> {
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();

  const workId = uuidv7();
  const workVersionId = uuidv7();
  const submissionId = uuidv7();
  const submissionVersionId = uuidv7();

  await prisma.work.create({
    data: {
      id: workId,
      date_created: now,
      date_modified: now,
      doi: params.workDoi,
      created_by: { connect: { id: testData.userId } },
    },
  });

  await prisma.workVersion.create({
    data: {
      id: workVersionId,
      date_created: now,
      date_modified: now,
      title: params.title,
      doi: params.workVersionDoi,
      authors: params.authors,
      cdn: 'https://test-cdn.com',
      cdn_key: `test-${workVersionId}`,
      work: { connect: { id: workId } },
    },
  });

  await prisma.submission.create({
    data: {
      id: submissionId,
      date_created: now,
      date_modified: now,
      date_published: params.datePublished ?? null,
      site: { connect: { id: testData.siteId } },
      work: { connect: { id: workId } },
      kind: { connect: { id: params.kindId } },
      collection: { connect: { id: params.collectionId } },
      submitted_by: { connect: { id: testData.userId } },
    },
  });

  await prisma.submissionVersion.create({
    data: {
      id: submissionVersionId,
      date_created: now,
      date_modified: now,
      status: params.status ?? 'APPROVED',
      submission: { connect: { id: submissionId } },
      work_version: { connect: { id: workVersionId } },
      submitted_by: { connect: { id: testData.userId } },
    },
  });

  return submissionId;
}

async function seedSubmissions(testData: TestData) {
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();

  // A second kind and collection so we can exercise the multi-select filters.
  const altKindId = uuidv7();
  const altCollectionId = uuidv7();
  await prisma.submissionKind.create({
    data: {
      id: altKindId,
      name: `Alt Kind ${altKindId}`,
      date_created: now,
      date_modified: now,
      default: false,
      content: {},
      site: { connect: { id: testData.siteId } },
    },
  });
  await prisma.collection.create({
    data: {
      id: altCollectionId,
      name: `Alt Collection ${altCollectionId}`,
      slug: `alt-${altCollectionId}`,
      date_created: now,
      date_modified: now,
      content: {},
      site: { connect: { id: testData.siteId } },
    },
  });

  // Default kind + default collection. Statuses are spread across the seed
  // rows so the `statuses` filter has something distinguishable to test
  // against; the other listing tests don't care which row carries which
  // status.
  const photoSynthesis = await createListedSubmission(testData, {
    title: 'Photosynthesis in low light conditions',
    authors: ['Garcia, Maria', 'Wong, Lei'],
    workDoi: '10.1234/work-photosynthesis',
    workVersionDoi: '10.1234/wv-photosynthesis-2024',
    kindId: testData.kindId,
    collectionId: testData.collectionId,
    datePublished: '2024-01-15',
    status: 'APPROVED',
  });

  const brontePoetry = await createListedSubmission(testData, {
    title: 'The poetry of solitude',
    authors: ['Brontë, Emily', 'Dickinson, Emily'],
    workDoi: '10.1234/work-bronte',
    workVersionDoi: '10.1234/wv-bronte-2024',
    kindId: testData.kindId,
    collectionId: testData.collectionId,
    datePublished: '2024-01-22',
    status: 'PENDING',
  });

  // Alt kind, default collection, later date — should NOT appear in Jan
  // window or when filtered by default kind.
  const weatherRadar = await createListedSubmission(testData, {
    title: 'Weather radar calibration techniques',
    authors: ['Singh, Arjun'],
    workDoi: '10.1234/work-radar',
    workVersionDoi: '10.1234/wv-radar-2024',
    kindId: altKindId,
    collectionId: testData.collectionId,
    datePublished: '2024-03-01',
    status: 'APPROVED',
  });

  // Default kind, alt collection — verifies collectionIds filter.
  const altCollectionSubmission = await createListedSubmission(testData, {
    title: 'Notes from a different collection',
    authors: ['Smith, John'],
    workDoi: '10.1234/work-altcol',
    workVersionDoi: '10.1234/wv-altcol-2024',
    kindId: testData.kindId,
    collectionId: altCollectionId,
    datePublished: '2024-02-10',
    status: 'REJECTED',
  });

  // Unpublished — date_published is null; this row is the only seed that
  // exercises the `unpublishedOnly` branch and proves that a January window
  // does NOT pick it up (strict date_published semantics, no fallback).
  const unpublishedSubmissionId = uuidv7();
  const unpublishedWorkId = uuidv7();
  const unpublishedWorkVersionId = uuidv7();
  await prisma.work.create({
    data: {
      id: unpublishedWorkId,
      date_created: '2024-01-10T00:00:00Z',
      date_modified: '2024-01-10T00:00:00Z',
      doi: null,
      created_by: { connect: { id: testData.userId } },
    },
  });
  await prisma.workVersion.create({
    data: {
      id: unpublishedWorkVersionId,
      date_created: '2024-01-10T00:00:00Z',
      date_modified: '2024-01-10T00:00:00Z',
      title: 'Pre-release algorithmic notes',
      doi: null,
      authors: ['Author, Unpublished'],
      cdn: 'https://test-cdn.com',
      cdn_key: `test-unpublished-${unpublishedSubmissionId}`,
      work: { connect: { id: unpublishedWorkId } },
    },
  });
  await prisma.submission.create({
    data: {
      id: unpublishedSubmissionId,
      date_created: '2024-01-10T00:00:00Z',
      date_modified: '2024-01-10T00:00:00Z',
      date_published: null,
      site: { connect: { id: testData.siteId } },
      work: { connect: { id: unpublishedWorkId } },
      kind: { connect: { id: testData.kindId } },
      collection: { connect: { id: testData.collectionId } },
      submitted_by: { connect: { id: testData.userId } },
    },
  });
  await prisma.submissionVersion.create({
    data: {
      id: uuidv7(),
      date_created: '2024-01-10T00:00:00Z',
      date_modified: '2024-01-10T00:00:00Z',
      status: 'APPROVED',
      submission: { connect: { id: unpublishedSubmissionId } },
      work_version: { connect: { id: unpublishedWorkVersionId } },
      submitted_by: { connect: { id: testData.userId } },
    },
  });

  // Work.doi set, WorkVersion.doi null — verifies the EXISTS subquery joins
  // through to Work for the DOI predicate.
  const workOnlyDoi = await createListedSubmission(testData, {
    title: 'A study with only a Work-level DOI',
    authors: ['Onlywork, Doi'],
    workDoi: '10.1234/work-only-doi-abc',
    workVersionDoi: null,
    kindId: testData.kindId,
    collectionId: testData.collectionId,
    datePublished: '2025-05-05',
    status: 'PUBLISHED',
  });

  return {
    altKindId,
    altCollectionId,
    submissions: {
      photoSynthesis: {
        id: photoSynthesis,
        title: 'Photosynthesis in low light conditions',
        authors: ['Garcia, Maria', 'Wong, Lei'],
        workDoi: '10.1234/work-photosynthesis',
        workVersionDoi: '10.1234/wv-photosynthesis-2024',
        kindId: testData.kindId,
        collectionId: testData.collectionId,
        datePublished: '2024-01-15',
        dateCreated: now,
      },
      brontePoetry: {
        id: brontePoetry,
        title: 'The poetry of solitude',
        authors: ['Brontë, Emily', 'Dickinson, Emily'],
        workDoi: '10.1234/work-bronte',
        workVersionDoi: '10.1234/wv-bronte-2024',
        kindId: testData.kindId,
        collectionId: testData.collectionId,
        datePublished: '2024-01-22',
        dateCreated: now,
      },
      weatherRadar: {
        id: weatherRadar,
        title: 'Weather radar calibration techniques',
        authors: ['Singh, Arjun'],
        workDoi: '10.1234/work-radar',
        workVersionDoi: '10.1234/wv-radar-2024',
        kindId: altKindId,
        collectionId: testData.collectionId,
        datePublished: '2024-03-01',
        dateCreated: now,
      },
      altCollectionSubmission: {
        id: altCollectionSubmission,
        title: 'Notes from a different collection',
        authors: ['Smith, John'],
        workDoi: '10.1234/work-altcol',
        workVersionDoi: '10.1234/wv-altcol-2024',
        kindId: testData.kindId,
        collectionId: altCollectionId,
        datePublished: '2024-02-10',
        dateCreated: now,
      },
      unpublishedAlgo: {
        id: unpublishedSubmissionId,
        title: 'Pre-release algorithmic notes',
        authors: ['Author, Unpublished'],
        workDoi: null,
        workVersionDoi: null,
        kindId: testData.kindId,
        collectionId: testData.collectionId,
        datePublished: null,
        dateCreated: '2024-01-10T00:00:00Z',
      },
      workOnlyDoi: {
        id: workOnlyDoi,
        title: 'A study with only a Work-level DOI',
        authors: ['Onlywork, Doi'],
        workDoi: '10.1234/work-only-doi-abc',
        workVersionDoi: null,
        kindId: testData.kindId,
        collectionId: testData.collectionId,
        datePublished: '2025-05-05',
        dateCreated: now,
      },
    },
  };
}
