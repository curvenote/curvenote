/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, beforeEach } from 'vitest';
import type { SiteRole } from '@curvenote/scms-db';
import { getPrismaClient, sites } from '@curvenote/scms-server';
import { doi as doiUtil } from 'doi-utils';
import { uuidv7 } from 'uuidv7';
import { createTestData, type TestData } from '../helpers/mocks';

/**
 * Golden-payload regression guard for `GET /v1/sites/:siteName/doi/:first/:second`
 * (resolved by `sites.doi`).
 *
 * Locks the delivered package — DTO shape, field mapping, the embedded
 * `versions` array, the tag path, and the 404 contract — so the performance
 * rewrite (DOI btree indexes, SubmissionVersion-rooted query, site-scoped
 * lookup, trimmed select) can be proven behaviour-preserving.
 *
 * The one *intended* behaviour change is asserted by `does not resolve a DOI
 * published on another site`: the pre-rewrite no-tag path ignored the site and
 * could return another site's work; the rewrite scopes every path to the site.
 */

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
  'versions',
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

const VERSION_KEYS = ['submission_version_id', 'version', 'date', 'tags'] as const;

describe('site doi resolve — delivered package', () => {
  let testData: TestData;
  let hostname: string;

  beforeEach(async () => {
    testData = await createTestData('ADMIN' as SiteRole);
    hostname = await attachDefaultDomain(testData);
  });

  test('resolves a published DOI to the full work DTO with a versions array', async () => {
    const seed = await seedPublishedWorkWithDoi(testData, {});
    const dto = await sites.doi(testData.context, seed.rawDoi);

    expect(Object.keys(dto).sort()).toEqual([...ITEM_KEYS].sort());
    expect(Object.keys(dto.links).sort()).toEqual([...ITEM_LINK_KEYS].sort());
    expect(Array.isArray(dto.versions)).toBe(true);
    expect(dto.versions).toHaveLength(1);
    expect(Object.keys(dto.versions[0]).sort()).toEqual([...VERSION_KEYS].sort());
  });

  test('maps every field of the resolved work correctly', async () => {
    const seed = await seedPublishedWorkWithDoi(testData, {
      authors: ['Ada Lovelace', 'Alan Turing'],
      datePublished: '2024-03-15',
      wvTags: ['preprint'],
    });
    const dto = await sites.doi(testData.context, seed.rawDoi);

    expect(dto.id).toBe(seed.workId);
    expect(dto.version_id).toBe(seed.workVersionId);
    expect(dto.submission_version_id).toBe(seed.svId);
    expect(dto.submission_id).toBe(seed.submissionId);
    expect(dto.doi).toBe(seed.normDoi);
    expect(dto.key).toBe(seed.workKey);
    expect(dto.slug).toBe(`${seed.slug}-${testData.siteId}`);
    expect(dto.title).toBe(seed.title);
    expect(dto.description).toBe(seed.description);
    expect(dto.authors).toEqual(seed.authors.map((name) => ({ name })));
    expect(dto.canonical).toBe(true);
    expect(dto.date).toBe(seed.datePublished);
    expect(dto.date_published).toBe(seed.datePublished);
    expect(dto.cdn).toBe('https://test-cdn.com');
    expect(dto.cdn_key).toBe(`cdn-key-${seed.workId}`);

    expect(dto.kind?.name).toBe(`Test Kind ${testData.kindId}`);
    expect(dto.kind?.default).toBe(true);
    expect(dto.collection?.slug).toBe(`test-collection-${testData.collectionId}`);

    expect(dto.links.self).toContain(
      `/sites/${testData.siteName}/works/${seed.workId}/versions/${seed.workVersionId}`,
    );
    expect(dto.links.work).toContain(`/works/${seed.workId}`);
    expect(dto.links.submission).toContain(
      `/sites/${testData.siteName}/submissions/${seed.submissionId}`,
    );
    expect(dto.links.html).toBe(`https://${hostname}/articles/${seed.workId}`);
    expect(dto.links.doi).toBe(`https://doi.org/${seed.normDoi}`);
  });

  test('embeds every published version, newest first, and resolves to the newest', async () => {
    const seed = await seedPublishedWorkWithDoi(testData, { datePublished: '2024-01-01' });
    const newer = await addPublishedVersion(testData, seed, {
      datePublished: '2024-06-01',
      svTags: ['v2'],
    });

    const dto = await sites.doi(testData.context, seed.rawDoi);

    // Resolves to the newest published submission version.
    expect(dto.submission_version_id).toBe(newer.svId);
    // versions array carries both, newest first.
    expect(dto.versions.map((v) => v.submission_version_id)).toEqual([newer.svId, seed.svId]);
    expect(dto.versions[0].tags).toEqual(['v2']);
  });

  test('versions array includes published versions without v{n} tags and excludes in-review', async () => {
    const seed = await seedPublishedWorkWithDoi(testData, {
      datePublished: '2024-01-01',
      svTags: ['preprint'],
    });
    const tagged = await addPublishedVersion(testData, seed, {
      datePublished: '2024-06-01',
      svTags: ['v2'],
    });
    await addInReviewVersion(testData, seed, { datePublished: '2024-07-01', svTags: ['v3'] });

    const dto = await sites.doi(testData.context, seed.rawDoi);

    expect(dto.versions.map((v) => v.submission_version_id)).toEqual([tagged.svId, seed.svId]);
    expect(dto.versions.find((v) => v.submission_version_id === seed.svId)).toMatchObject({
      version: undefined,
      tags: ['preprint'],
    });
    expect(dto.versions.find((v) => v.submission_version_id === tagged.svId)?.version).toBe('v2');
  });

  test('tag path resolves the tagged version; an absent tag is a 404', async () => {
    const seed = await seedPublishedWorkWithDoi(testData, { svTags: ['hhmi'] });

    const dto = await sites.doi(testData.context, seed.rawDoi, { tag: 'hhmi' });
    expect(dto.submission_version_id).toBe(seed.svId);

    await expectRejects404(sites.doi(testData.context, seed.rawDoi, { tag: 'nope' }));
  });

  test('does not resolve a DOI published on another site', async () => {
    const otherSiteId = await createBareSite();
    const seed = await seedPublishedWorkWithDoi(testData, { siteId: otherSiteId });

    // The DOI exists, but only on another site — this site must 404.
    await expectRejects404(sites.doi(testData.context, seed.rawDoi));
  });

  test('invalid DOI is a 404', async () => {
    await expectRejects404(sites.doi(testData.context, 'not-a-doi'), 'Not Found - Invalid DOI');
  });

  test('unknown DOI is a 404 with the work-not-found message', async () => {
    await expectRejects404(
      sites.doi(testData.context, '10.5555/does-not-exist'),
      'Not Found - No work with that DOI exists in database',
    );
  });
});

describe('sites.submissions.published.get — delivered package', () => {
  let testData: TestData;

  beforeEach(async () => {
    testData = await createTestData('ADMIN' as SiteRole);
    await attachDefaultDomain(testData);
  });

  test('returns the same DTO shape as doi resolve, including a versions array', async () => {
    const seed = await seedPublishedWorkWithDoi(testData, {});
    const dto = await sites.submissions.published.get(testData.context, seed.workId);

    expect(dto).not.toBeNull();
    expect(Object.keys(dto!).sort()).toEqual([...ITEM_KEYS].sort());
    expect(Array.isArray(dto!.versions)).toBe(true);
    expect(dto!.versions).toHaveLength(1);
    expect(Object.keys(dto!.versions[0]).sort()).toEqual([...VERSION_KEYS].sort());
  });

  test('embeds every published version, newest first, and resolves to the newest', async () => {
    const seed = await seedPublishedWorkWithDoi(testData, { datePublished: '2024-01-01' });
    const newer = await addPublishedVersion(testData, seed, {
      datePublished: '2024-06-01',
      svTags: ['v2'],
    });

    const dto = await sites.submissions.published.get(testData.context, seed.workId);

    expect(dto!.submission_version_id).toBe(newer.svId);
    expect(dto!.versions.map((v) => v.submission_version_id)).toEqual([newer.svId, seed.svId]);
  });

  test('resolves by slug as well as work id', async () => {
    const seed = await seedPublishedWorkWithDoi(testData, {});
    const slug = `${seed.slug}-${testData.siteId}`;

    const byId = await sites.submissions.published.get(testData.context, seed.workId);
    const bySlug = await sites.submissions.published.get(testData.context, slug);

    expect(bySlug).toEqual(byId);
  });

  test('returns null when no published work matches', async () => {
    const dto = await sites.submissions.published.get(testData.context, uuidv7());
    expect(dto).toBeNull();
  });
});

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

async function expectRejects404(p: Promise<unknown>, statusText?: string): Promise<void> {
  const err = await p.then(
    () => {
      throw new Error('expected the call to reject with a 404');
    },
    (e) => e,
  );
  expect(err).toBeInstanceOf(Response);
  expect((err as Response).status).toBe(404);
  if (statusText) expect((err as Response).statusText).toBe(statusText);
}

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

async function createBareSite(): Promise<string> {
  const prisma = await getPrismaClient();
  const siteId = uuidv7();
  const now = new Date().toISOString();
  await prisma.site.create({
    data: {
      id: siteId,
      name: `other-site-${siteId}`,
      title: 'Other Site',
      private: false,
      date_created: now,
      date_modified: now,
      metadata: {},
      external: false,
      restricted: true,
      default_workflow: 'SIMPLE',
      slug_strategy: 'NONE',
      description: null,
    },
  });
  return siteId;
}

interface DoiSeed {
  workId: string;
  workVersionId: string;
  submissionId: string;
  svId: string;
  rawDoi: string;
  normDoi: string;
  workKey: string;
  title: string;
  description: string;
  authors: string[];
  datePublished: string;
  slug: string;
}

async function seedPublishedWorkWithDoi(
  testData: TestData,
  opts: {
    authors?: string[];
    datePublished?: string;
    wvTags?: string[];
    svTags?: string[];
    siteId?: string;
  },
): Promise<DoiSeed> {
  const prisma = await getPrismaClient();
  const siteId = opts.siteId ?? testData.siteId;
  const workId = uuidv7();
  const workVersionId = uuidv7();
  const submissionId = uuidv7();
  const svId = uuidv7();
  const now = new Date().toISOString();
  const rawDoi = `10.5555/${workId}`;
  const normDoi = doiUtil.normalize(rawDoi) as string;
  const seed: DoiSeed = {
    workId,
    workVersionId,
    submissionId,
    svId,
    rawDoi,
    normDoi,
    workKey: `key-${workId}`,
    title: `DOI work ${workId}`,
    description: `Description for ${workId}`,
    authors: opts.authors ?? ['Ada Lovelace'],
    datePublished: opts.datePublished ?? '2024-03-01',
    slug: `doi-work-${workId}`,
  };

  await prisma.work.create({
    data: {
      id: seed.workId,
      date_created: now,
      date_modified: now,
      doi: seed.normDoi,
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
      doi: seed.normDoi,
      authors: seed.authors,
      canonical: true,
      tags: opts.wvTags ?? [],
      cdn: 'https://test-cdn.com',
      cdn_key: `cdn-key-${seed.workId}`,
      work: { connect: { id: seed.workId } },
    },
  });
  await prisma.submission.create({
    data: {
      id: seed.submissionId,
      date_created: now,
      date_modified: now,
      date_published: seed.datePublished,
      site: { connect: { id: siteId } },
      work: { connect: { id: seed.workId } },
      kind: { connect: { id: testData.kindId } },
      collection: { connect: { id: testData.collectionId } },
      submitted_by: { connect: { id: testData.userId } },
    },
  });
  await prisma.submissionVersion.create({
    data: {
      id: seed.svId,
      date_created: now,
      date_modified: now,
      date_published: seed.datePublished,
      status: 'PUBLISHED',
      tags: opts.svTags ?? [],
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
      slug: `${seed.slug}-${siteId}`,
      primary: true,
      site: { connect: { id: siteId } },
      submission: { connect: { id: seed.submissionId } },
    },
  });

  return seed;
}

/** Adds a newer published submission version (new work version) to an existing submission. */
async function addPublishedVersion(
  testData: TestData,
  seed: DoiSeed,
  opts: { datePublished: string; svTags?: string[] },
): Promise<{ svId: string; workVersionId: string }> {
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();
  const workVersionId = uuidv7();
  const svId = uuidv7();
  await prisma.workVersion.create({
    data: {
      id: workVersionId,
      date_created: now,
      date_modified: now,
      title: seed.title,
      doi: seed.normDoi,
      authors: seed.authors,
      canonical: true,
      tags: [],
      cdn: 'https://test-cdn.com',
      cdn_key: `cdn-key-${workVersionId}`,
      work: { connect: { id: seed.workId } },
    },
  });
  await prisma.submissionVersion.create({
    data: {
      id: svId,
      date_created: now,
      date_modified: now,
      date_published: opts.datePublished,
      status: 'PUBLISHED',
      tags: opts.svTags ?? [],
      submission: { connect: { id: seed.submissionId } },
      work_version: { connect: { id: workVersionId } },
      submitted_by: { connect: { id: testData.userId } },
    },
  });
  return { svId, workVersionId };
}

/** Adds an in-review submission version (must not appear in DOI `versions`). */
async function addInReviewVersion(
  testData: TestData,
  seed: DoiSeed,
  opts: { datePublished: string; svTags?: string[] },
): Promise<{ svId: string; workVersionId: string }> {
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();
  const workVersionId = uuidv7();
  const svId = uuidv7();
  await prisma.workVersion.create({
    data: {
      id: workVersionId,
      date_created: now,
      date_modified: now,
      title: seed.title,
      doi: seed.normDoi,
      authors: seed.authors,
      canonical: true,
      tags: [],
      cdn: 'https://test-cdn.com',
      cdn_key: `cdn-key-${workVersionId}`,
      work: { connect: { id: seed.workId } },
    },
  });
  await prisma.submissionVersion.create({
    data: {
      id: svId,
      date_created: now,
      date_modified: now,
      date_published: opts.datePublished,
      status: 'IN_REVIEW',
      tags: opts.svTags ?? [],
      submission: { connect: { id: seed.submissionId } },
      work_version: { connect: { id: workVersionId } },
      submitted_by: { connect: { id: testData.userId } },
    },
  });
  return { svId, workVersionId };
}
