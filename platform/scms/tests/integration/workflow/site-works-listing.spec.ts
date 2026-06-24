/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, beforeEach } from 'vitest';
import type { SiteRole } from '@curvenote/scms-db';
import { getPrismaClient } from '@curvenote/scms-server';
import { concatSiteWorkTags } from '@curvenote/common';
import { uuidv7 } from 'uuidv7';
import { createTestData, type TestData } from '../helpers/mocks';

import { listPublishedWorks } from '../../../app/routes/api/v1.sites.$siteName.works/db.server';

/**
 * Golden-payload regression guard for `GET /v1/sites/:siteName/works`.
 *
 * This locks the *delivered package* of the public works listing — the exact
 * DTO shape, pagination envelope, ordering, and field mapping — against an
 * "etl-benchmark"-style seed of 12 published works queried at `limit=10`.
 *
 * It exists so the upcoming performance rewrite of
 * `app/routes/api/v1.sites.$siteName.works/db.server.ts` (Submission-rooted
 * query, DB-side count, restored LIMIT pushdown, trimmed select) can be proven
 * to deliver the byte-for-shape-equivalent payload it does today. The tests
 * assert structure + mapping + order rather than the random per-run ids/URLs,
 * so they survive the implementation swap while still failing loudly if a
 * field is dropped, renamed, reordered, or mis-mapped.
 */

const TOTAL_PUBLISHED = 12;
const PAGE_LIMIT = 10;

/** Expected top-level keys of the listing DTO. */
const LISTING_KEYS = ['items', 'total', 'links'] as const;

/** Expected keys of each item (SiteWorkDTO as shaped by formatSiteWorkDTO). */
const ITEM_KEYS = [
  'id',
  'version_id',
  'submission_version_id',
  'cdn',
  'cdn_key',
  'slug',
  'doi',
  'key',
  'cdn_query',
  'title',
  'description',
  'subject',
  'authors',
  'canonical',
  'tags',
  'date_created',
  'date',
  'date_published',
  'kind',
  'collection',
  'submission_id',
  'links',
] as const;

const ITEM_LINK_KEYS = [
  'self',
  'site',
  'work',
  'submission',
  'versions',
  'html',
  'thumbnail',
  'social',
  'config',
  'doi',
] as const;

const KIND_SUMMARY_KEYS = ['id', 'name', 'content', 'default'] as const;
const COLLECTION_SUMMARY_KEYS = ['id', 'name', 'slug', 'workflow', 'content', 'open'] as const;

describe('site works listing — abort handling', () => {
  test('q search short-circuits when the request is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      listPublishedWorks(
        {} as TestData['context'],
        [],
        { q: 'work 03' },
        { page: 0, limit: 500 },
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

interface SeedWork {
  workId: string;
  workVersionId: string;
  submissionId: string;
  title: string;
  description: string;
  authors: string[];
  subject?: string;
  workDoi: string;
  workKey: string;
  workVersionTags: string[];
  slug: string;
  datePublished: string; // ISO date — drives ordering
  canonical: boolean;
}

describe('site works listing — delivered package (limit=10)', () => {
  let testData: TestData;
  let hostname: string;
  let seeds: SeedWork[];

  beforeEach(async () => {
    testData = await createTestData('ADMIN' as SiteRole);
    hostname = await attachDefaultDomain(testData);
    seeds = await seedPublishedWorks(testData, TOTAL_PUBLISHED);
    // Drafts must never surface in the published listing.
    await seedDraftWorks(testData, 2);
  });

  test('returns the listing envelope with exactly {items, total, links}', async () => {
    const dto = await listPublishedWorks(testData.context, [], {}, { page: 0, limit: PAGE_LIMIT });
    expect(Object.keys(dto).sort()).toEqual([...LISTING_KEYS].sort());
  });

  test('total counts every published work; page is capped at the limit', async () => {
    const dto = await listPublishedWorks(testData.context, [], {}, { page: 0, limit: PAGE_LIMIT });
    expect(dto.total).toBe(TOTAL_PUBLISHED);
    expect(dto.items).toHaveLength(PAGE_LIMIT);
  });

  test('excludes draft submissions (only PUBLISHED versions are listed)', async () => {
    const dto = await listPublishedWorks(testData.context, [], {}, { page: 0, limit: 500 });
    expect(dto.items).toHaveLength(TOTAL_PUBLISHED);
    const seededIds = new Set(seeds.map((s) => s.workId));
    for (const item of dto.items) expect(seededIds.has(item.id)).toBe(true);
  });

  test('lists the latest published version even when it has no v{n} tags', async () => {
    const prisma = await getPrismaClient();
    const seed = seeds[0];
    const now = new Date().toISOString();
    const newerWorkVersionId = uuidv7();
    const newerSvId = uuidv7();

    await prisma.workVersion.create({
      data: {
        id: newerWorkVersionId,
        date_created: now,
        date_modified: now,
        title: `${seed.title} (untagged)`,
        doi: seed.workDoi,
        authors: seed.authors,
        canonical: true,
        tags: [],
        cdn: 'https://test-cdn.com',
        cdn_key: `cdn-key-untagged-${seed.workId}`,
        work: { connect: { id: seed.workId } },
      },
    });
    await prisma.submissionVersion.create({
      data: {
        id: newerSvId,
        date_created: now,
        date_modified: now,
        date_published: '2025-06-01',
        status: 'PUBLISHED',
        tags: ['preprint'],
        submission: { connect: { id: seed.submissionId } },
        work_version: { connect: { id: newerWorkVersionId } },
        submitted_by: { connect: { id: testData.userId } },
      },
    });

    const dto = await listPublishedWorks(testData.context, [], {}, { page: 0, limit: 500 });
    const item = dto.items.find((i) => i.id === seed.workId);
    expect(item).toBeTruthy();
    expect(item!.version_id).toBe(newerWorkVersionId);
    expect(item!.tags).toEqual(['preprint']);
    expect(item!.versions).toBeUndefined();
  });

  test('orders by date_published descending', async () => {
    const dto = await listPublishedWorks(testData.context, [], {}, { page: 0, limit: PAGE_LIMIT });
    const expectedOrder = [...seeds]
      .sort((a, b) => (a.datePublished < b.datePublished ? 1 : -1))
      .slice(0, PAGE_LIMIT)
      .map((s) => s.workId);
    expect(dto.items.map((i) => i.id)).toEqual(expectedOrder);

    const dates = dto.items.map((i) => i.date_published).filter((d): d is string => d != null);
    const sorted = [...dates].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    expect(dates).toEqual(sorted);
  });

  test('pagination links: self carries page/limit, next on first page, no prev', async () => {
    const dto = await listPublishedWorks(testData.context, [], {}, { page: 0, limit: PAGE_LIMIT });
    expect(typeof dto.links.self).toBe('string');
    expect(dto.links.self).toContain(`/sites/${testData.siteName}/works`);
    expect(dto.links.self).toContain('page=0');
    expect(dto.links.self).toContain('limit=10');
    expect(typeof dto.links.site).toBe('string');
    expect(dto.links.site).toContain(`/sites/${testData.siteName}`);
    // 12 total > 10 per page ⇒ a next link, no prev on page 0.
    expect(typeof dto.links.next).toBe('string');
    expect(dto.links.next).toContain('page=1');
    expect(dto.links.prev).toBeUndefined();
  });

  test('the second offset page returns the remaining works, disjoint and correctly ordered', async () => {
    const page0 = await listPublishedWorks(
      testData.context,
      [],
      {},
      { page: 0, limit: PAGE_LIMIT },
    );
    const page1 = await listPublishedWorks(
      testData.context,
      [],
      {},
      { page: 1, limit: PAGE_LIMIT },
    );

    // total is stable across pages; the second page holds the remainder.
    expect(page0.total).toBe(TOTAL_PUBLISHED);
    expect(page1.total).toBe(TOTAL_PUBLISHED);
    expect(page1.items).toHaveLength(TOTAL_PUBLISHED - PAGE_LIMIT);

    // Page 2 continues the date_published desc order from where page 1 stopped.
    const expectedOrder = [...seeds]
      .sort((a, b) => (a.datePublished < b.datePublished ? 1 : -1))
      .map((s) => s.workId);
    expect(page0.items.map((i) => i.id)).toEqual(expectedOrder.slice(0, PAGE_LIMIT));
    expect(page1.items.map((i) => i.id)).toEqual(expectedOrder.slice(PAGE_LIMIT));

    // The two pages are disjoint and together cover every published work.
    const page0Ids = new Set(page0.items.map((i) => i.id));
    const page1Ids = new Set(page1.items.map((i) => i.id));
    for (const id of page1Ids) expect(page0Ids.has(id)).toBe(false);
    expect(new Set([...page0Ids, ...page1Ids]).size).toBe(TOTAL_PUBLISHED);

    // On the last page there is a prev link (page 0) and no next.
    expect(typeof page1.links.prev).toBe('string');
    expect(page1.links.prev).toContain('page=0');
    expect(page1.links.self).toContain('page=1');
    expect(page1.links.next).toBeUndefined();
  });

  test('every item has the exact DTO shape (keys never drift)', async () => {
    const dto = await listPublishedWorks(testData.context, [], {}, { page: 0, limit: PAGE_LIMIT });
    for (const item of dto.items) {
      expect(Object.keys(item).sort()).toEqual([...ITEM_KEYS].sort());
      expect(Object.keys(item.links).sort()).toEqual([...ITEM_LINK_KEYS].sort());
      expect(item.kind).toBeTruthy();
      expect(Object.keys(item.kind!).sort()).toEqual([...KIND_SUMMARY_KEYS].sort());
      expect(item.collection).toBeTruthy();
      expect(Object.keys(item.collection!).sort()).toEqual([...COLLECTION_SUMMARY_KEYS].sort());
    }
  });

  test('maps every field of the newest work correctly', async () => {
    const dto = await listPublishedWorks(testData.context, [], {}, { page: 0, limit: PAGE_LIMIT });
    const newest = [...seeds].sort((a, b) => (a.datePublished < b.datePublished ? 1 : -1))[0];
    const item = dto.items[0];

    // Identity / scalars
    expect(item.id).toBe(newest.workId);
    expect(item.version_id).toBe(newest.workVersionId);
    expect(item.submission_id).toBe(newest.submissionId);
    expect(item.title).toBe(newest.title);
    expect(item.description).toBe(newest.description);
    expect(item.authors).toEqual(newest.authors.map((name) => ({ name })));
    expect(item.doi).toBe(newest.workDoi);
    expect(item.key).toBe(newest.workKey);
    expect(item.slug).toBe(`${newest.slug}-${testData.siteId}`);
    expect(item.canonical).toBe(newest.canonical);
    expect(item.tags).toEqual(concatSiteWorkTags([], newest.workVersionTags));
    expect(item.subject).toBe(newest.subject);
    expect(item.cdn).toBe('https://test-cdn.com');
    expect(item.cdn_key).toBe(`cdn-key-${newest.slug}`);
    expect(item.date).toBe(newest.datePublished);
    expect(item.date_published).toBe(newest.datePublished);
    expect(typeof item.date_created).toBe('string');

    // Nested summaries
    expect(item.kind?.name).toBe(`Test Kind ${testData.kindId}`);
    expect(item.kind?.default).toBe(true);
    expect(item.kind?.content).toEqual({});
    expect(item.collection?.name).toBe(`Test Collection ${testData.collectionId}`);
    expect(item.collection?.slug).toBe(`test-collection-${testData.collectionId}`);
    expect(item.collection?.workflow).toBe('SIMPLE');
    expect(item.collection?.open).toBe(true);

    // Link mapping
    expect(item.links.self).toContain(
      `/sites/${testData.siteName}/works/${newest.workId}/versions/${newest.workVersionId}`,
    );
    expect(item.links.work).toContain(`/works/${newest.workId}`);
    expect(item.links.submission).toContain(
      `/sites/${testData.siteName}/submissions/${newest.submissionId}`,
    );
    expect(item.links.versions).toContain(
      `/sites/${testData.siteName}/submissions/${newest.submissionId}/versions`,
    );
    expect(item.links.html).toBe(`https://${hostname}/articles/${newest.workId}`);
    expect(item.links.doi).toBe(`https://doi.org/${newest.workDoi}`);
    // public site (no private signing) ⇒ thumbnail/social are the API URLs, no query
    expect(item.links.thumbnail).toContain(
      `/sites/${testData.siteName}/works/${newest.workId}/versions/${newest.workVersionId}/thumbnail`,
    );
    expect(item.links.social).toContain(
      `/sites/${testData.siteName}/works/${newest.workId}/versions/${newest.workVersionId}/social`,
    );
    expect(item.cdn_query).toBeUndefined();
  });
});

describe('site works listing — search / sort / date filters', () => {
  let testData: TestData;
  let seeds: SeedWork[];

  beforeEach(async () => {
    testData = await createTestData('ADMIN' as SiteRole);
    await attachDefaultDomain(testData);
    seeds = await seedPublishedWorks(testData, TOTAL_PUBLISHED);
    await seedDraftWorks(testData, 2);
  });

  test('q matches a title substring', async () => {
    const dto = await listPublishedWorks(
      testData.context,
      [],
      { q: 'work 03' },
      { page: 0, limit: 500 },
    );
    expect(dto.total).toBe(1);
    expect(dto.items[0].title).toBe('Benchmark work 03');
  });

  test('q matches an author substring (text[] column)', async () => {
    const dto = await listPublishedWorks(
      testData.context,
      [],
      { q: 'Author 5A' },
      { page: 0, limit: 500 },
    );
    expect(dto.total).toBe(1);
    expect(dto.items[0].id).toBe(seeds[5].workId);
  });

  test('q matches a DOI substring', async () => {
    const dto = await listPublishedWorks(
      testData.context,
      [],
      { q: 'bench-work-07' },
      { page: 0, limit: 500 },
    );
    expect(dto.total).toBe(1);
    expect(dto.items[0].id).toBe(seeds[7].workId);
  });

  test('q matches an affiliation name from work version metadata', async () => {
    const prisma = await getPrismaClient();
    await prisma.workVersion.update({
      where: { id: seeds[3].workVersionId },
      data: {
        metadata: {
          'frontmatter.myst': {
            affiliations: [
              { id: 'a1', name: 'Systems Biology Department, Harvard Medical School' },
              {
                id: 'a2',
                name: 'Wyss Institute for Biologically Inspired Engineering, Harvard University',
              },
            ],
          },
        },
      },
    });

    const dto = await listPublishedWorks(
      testData.context,
      [],
      { q: 'Harvard Medical School' },
      { page: 0, limit: 500 },
    );
    expect(dto.total).toBe(1);
    expect(dto.items[0].id).toBe(seeds[3].workId);
  });

  test('q matches a second affiliation name on the same work', async () => {
    const prisma = await getPrismaClient();
    await prisma.workVersion.update({
      where: { id: seeds[8].workVersionId },
      data: {
        metadata: {
          'frontmatter.myst': {
            affiliations: [
              { id: 'a1', name: 'Wyss Institute for Biologically Inspired Engineering' },
            ],
          },
        },
      },
    });

    const dto = await listPublishedWorks(
      testData.context,
      [],
      { q: 'Wyss Institute' },
      { page: 0, limit: 500 },
    );
    expect(dto.total).toBe(1);
    expect(dto.items[0].id).toBe(seeds[8].workId);
  });

  test('q skips affiliation-only matches for stopword-only queries', async () => {
    const prisma = await getPrismaClient();
    await prisma.workVersion.update({
      where: { id: seeds[4].workVersionId },
      data: {
        metadata: {
          'frontmatter.myst': {
            affiliations: [{ id: 'a1', name: 'Example University Research Center' }],
          },
        },
      },
    });

    const dto = await listPublishedWorks(
      testData.context,
      [],
      { q: 'University' },
      { page: 0, limit: 500 },
    );
    expect(dto.total).toBe(0);
  });

  test('q still matches a distinctive affiliation token when stopwords are present', async () => {
    const prisma = await getPrismaClient();
    await prisma.workVersion.update({
      where: { id: seeds[4].workVersionId },
      data: {
        metadata: {
          'frontmatter.myst': {
            affiliations: [{ id: 'a1', name: 'Example University Research Center' }],
          },
        },
      },
    });

    const dto = await listPublishedWorks(
      testData.context,
      [],
      { q: 'Example' },
      { page: 0, limit: 500 },
    );
    expect(dto.total).toBe(1);
    expect(dto.items[0].id).toBe(seeds[4].workId);
  });

  test('q with no matches returns an empty listing', async () => {
    const dto = await listPublishedWorks(
      testData.context,
      [],
      { q: 'no-such-work-zzz' },
      { page: 0, limit: 500 },
    );
    expect(dto.total).toBe(0);
    expect(dto.items).toHaveLength(0);
  });

  test('q on a published listing ignores draft-only submission versions', async () => {
    const dto = await listPublishedWorks(
      testData.context,
      [],
      { q: 'Draft work' },
      { page: 0, limit: 500 },
    );
    expect(dto.total).toBe(0);
    expect(dto.items).toHaveLength(0);
  });

  test('q on a published listing ignores unpublished version text on a resubmission', async () => {
    const prisma = await getPrismaClient();
    const now = new Date().toISOString();
    const draftWorkVersionId = uuidv7();
    await prisma.workVersion.create({
      data: {
        id: draftWorkVersionId,
        date_created: now,
        date_modified: now,
        title: 'Unpublished resubmit title unique-xyz',
        authors: [],
        work: { connect: { id: seeds[0].workId } },
      },
    });
    await prisma.submissionVersion.create({
      data: {
        id: uuidv7(),
        date_created: now,
        date_modified: now,
        status: 'DRAFT',
        submission: { connect: { id: seeds[0].submissionId } },
        work_version: { connect: { id: draftWorkVersionId } },
        submitted_by: { connect: { id: testData.userId } },
      },
    });

    const dto = await listPublishedWorks(
      testData.context,
      [],
      { q: 'unique-xyz' },
      { page: 0, limit: 500 },
    );
    expect(dto.total).toBe(0);
    expect(dto.items).toHaveLength(0);
  });

  test('subject filters to an exact case-insensitive metadata match', async () => {
    const dto = await listPublishedWorks(
      testData.context,
      [],
      { subject: 'neuroscience' },
      { page: 0, limit: 500 },
    );
    expect(dto.total).toBe(1);
    expect(dto.items[0].id).toBe(seeds[0].workId);
    expect(dto.items[0].subject).toBe('Neuroscience');
  });

  test('subject with no matches returns an empty listing', async () => {
    const dto = await listPublishedWorks(
      testData.context,
      [],
      { subject: 'no-such-subject' },
      { page: 0, limit: 500 },
    );
    expect(dto.total).toBe(0);
    expect(dto.items).toHaveLength(0);
  });

  test('subject combines with q by intersection', async () => {
    const dto = await listPublishedWorks(
      testData.context,
      [],
      { subject: 'Genomics', q: 'work 05' },
      { page: 0, limit: 500 },
    );
    expect(dto.total).toBe(1);
    expect(dto.items[0].id).toBe(seeds[5].workId);
  });

  test('subject and q with disjoint matches returns an empty listing', async () => {
    const dto = await listPublishedWorks(
      testData.context,
      [],
      { subject: 'Neuroscience', q: 'work 05' },
      { page: 0, limit: 500 },
    );
    expect(dto.total).toBe(0);
    expect(dto.items).toHaveLength(0);
  });

  test('pagination links preserve subject', async () => {
    const dto = await listPublishedWorks(
      testData.context,
      [],
      { subject: 'Genomics' },
      { page: 0, limit: 10 },
    );
    expect(dto.links.self).toContain('subject=Genomics');
  });

  test('sort published_asc reverses the default ordering', async () => {
    const dto = await listPublishedWorks(
      testData.context,
      [],
      {},
      { page: 0, limit: 500, sort: 'published_asc' },
    );
    const expectedOrder = [...seeds]
      .sort((a, b) => (a.datePublished < b.datePublished ? -1 : 1))
      .map((s) => s.workId);
    expect(dto.items.map((i) => i.id)).toEqual(expectedOrder);
  });

  test('from/to filters to an inclusive date_published window', async () => {
    // seeds[i].datePublished === 2024-01-(i+1); window 2024-01-05..2024-01-07
    const dto = await listPublishedWorks(
      testData.context,
      [],
      { from: '2024-01-05', to: '2024-01-07' },
      { page: 0, limit: 500 },
    );
    expect(dto.total).toBe(3);
    expect(new Set(dto.items.map((i) => i.id))).toEqual(
      new Set([seeds[4].workId, seeds[5].workId, seeds[6].workId]),
    );
  });

  // A calendar-invalid `to` parses to `Invalid Date` → "NaN-NaN-NaN", which
  // sorts after every digit and would silently disable the upper bound (match
  // all rows). The db-layer guard must reject it instead. (The route schema is
  // the primary gate; this locks the lower-layer defense-in-depth.)
  test('a calendar-invalid `to` is rejected, not silently ignored', async () => {
    await expect(
      listPublishedWorks(testData.context, [], { to: '2024-13-45' }, { page: 0, limit: 500 }),
    ).rejects.toThrow();
  });
});

/* ---------------------------------------------------------------------------
 * Seeding helpers
 * ------------------------------------------------------------------------ */

async function attachDefaultDomain(testData: TestData): Promise<string> {
  const prisma = await getPrismaClient();
  const hostname = `t-${testData.siteId}.example.com`;
  await prisma.domain.create({
    data: {
      id: uuidv7(),
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      hostname,
      default: true,
      site: { connect: { id: testData.siteId } },
    },
  });
  // Keep the in-memory context site in sync so createArticleUrl resolves.
  testData.context.site = {
    ...testData.context.site,
    domains: [
      {
        id: uuidv7(),
        date_created: new Date().toISOString(),
        date_modified: new Date().toISOString(),
        hostname,
        default: true,
        site_id: testData.siteId,
      },
    ],
  };
  return hostname;
}

async function seedPublishedWorks(testData: TestData, count: number): Promise<SeedWork[]> {
  const prisma = await getPrismaClient();
  const seeds: SeedWork[] = [];

  for (let i = 0; i < count; i += 1) {
    const slug = `work-${i.toString().padStart(2, '0')}`;
    const seed: SeedWork = {
      workId: uuidv7(),
      workVersionId: uuidv7(),
      submissionId: uuidv7(),
      title: `Benchmark work ${i.toString().padStart(2, '0')}`,
      description: `Description for work ${i}`,
      authors: [`Author ${i}A`, `Author ${i}B`],
      subject: i === 0 ? 'Neuroscience' : i === 5 ? 'Genomics' : undefined,
      workDoi: `10.9999/bench-${slug}-${testData.siteId}`,
      workKey: `key-${slug}-${testData.siteId}`,
      workVersionTags: [`tag-${i}`],
      slug,
      datePublished: `2024-01-${(i + 1).toString().padStart(2, '0')}`,
      canonical: true,
    };
    const now = new Date().toISOString();

    await prisma.work.create({
      data: {
        id: seed.workId,
        date_created: now,
        date_modified: now,
        doi: seed.workDoi,
        key: seed.workKey,
        created_by: { connect: { id: testData.userId } },
      },
    });
    await prisma.workVersion.create({
      data: {
        id: seed.workVersionId,
        date_created: now,
        date_modified: now,
        title: seed.title,
        description: seed.description,
        doi: seed.workDoi,
        authors: seed.authors,
        canonical: seed.canonical,
        tags: seed.workVersionTags,
        cdn: 'https://test-cdn.com',
        cdn_key: `cdn-key-${seed.slug}`,
        metadata:
          seed.subject != null
            ? {
                'frontmatter.myst': {
                  subject: seed.subject,
                },
              }
            : undefined,
        work: { connect: { id: seed.workId } },
      },
    });
    await prisma.submission.create({
      data: {
        id: seed.submissionId,
        date_created: now,
        date_modified: now,
        date_published: seed.datePublished,
        site: { connect: { id: testData.siteId } },
        work: { connect: { id: seed.workId } },
        kind: { connect: { id: testData.kindId } },
        collection: { connect: { id: testData.collectionId } },
        submitted_by: { connect: { id: testData.userId } },
      },
    });
    await prisma.submissionVersion.create({
      data: {
        id: uuidv7(),
        date_created: now,
        date_modified: now,
        date_published: seed.datePublished,
        status: 'PUBLISHED',
        tags: [],
        submission: { connect: { id: seed.submissionId } },
        work_version: { connect: { id: seed.workVersionId } },
        submitted_by: { connect: { id: testData.userId } },
      },
    });
    await prisma.slug.create({
      data: {
        id: uuidv7(),
        date_created: now,
        date_modified: now,
        slug: `${seed.slug}-${testData.siteId}`,
        primary: true,
        site: { connect: { id: testData.siteId } },
        submission: { connect: { id: seed.submissionId } },
      },
    });

    seeds.push(seed);
  }

  return seeds;
}

async function seedDraftWorks(testData: TestData, count: number): Promise<void> {
  const prisma = await getPrismaClient();
  for (let i = 0; i < count; i += 1) {
    const now = new Date().toISOString();
    const workId = uuidv7();
    const workVersionId = uuidv7();
    const submissionId = uuidv7();
    await prisma.work.create({
      data: {
        id: workId,
        date_created: now,
        date_modified: now,
        created_by: { connect: { id: testData.userId } },
      },
    });
    await prisma.workVersion.create({
      data: {
        id: workVersionId,
        date_created: now,
        date_modified: now,
        title: `Draft work ${i}`,
        authors: [],
        work: { connect: { id: workId } },
      },
    });
    await prisma.submission.create({
      data: {
        id: submissionId,
        date_created: now,
        date_modified: now,
        site: { connect: { id: testData.siteId } },
        work: { connect: { id: workId } },
        kind: { connect: { id: testData.kindId } },
        collection: { connect: { id: testData.collectionId } },
        submitted_by: { connect: { id: testData.userId } },
      },
    });
    await prisma.submissionVersion.create({
      data: {
        id: uuidv7(),
        date_created: now,
        date_modified: now,
        status: 'DRAFT',
        submission: { connect: { id: submissionId } },
        work_version: { connect: { id: workVersionId } },
        submitted_by: { connect: { id: testData.userId } },
      },
    });
  }
}
