/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, beforeEach } from 'vitest';
import type { SiteRole } from '@curvenote/scms-db';
import { getPrismaClient } from '@curvenote/scms-server';
import { listSubmissionCatalog } from '../../../app/routes/api/v1.submissions/db.server';
import { resolveGlobalCatalogDoi } from '../../../app/routes/api/v1.doi.$first.$second/resolve.server';
import { doi as doiUtil } from 'doi-utils';
import { uuidv7 } from 'uuidv7';
import { createTestData, type TestData } from '../helpers/mocks';

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
  'site',
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
  'resolve',
] as const;

describe('submission catalog listing — delivered package', () => {
  let testData: TestData;

  beforeEach(async () => {
    testData = await createTestData('ADMIN' as SiteRole);
    await seedPublishedWorkWithDoi(testData, {});
  });

  test('lists published submissions across public sites with site summary and resolve link', async () => {
    const dto = await listSubmissionCatalog(
      testData.context,
      [],
      { site: [testData.siteName] },
      { page: 0, limit: 10 },
    );

    expect(dto.total).toBeGreaterThanOrEqual(1);
    expect(dto.items.length).toBeGreaterThanOrEqual(1);
    const item = dto.items[0];
    expect(Object.keys(item).sort()).toEqual([...ITEM_KEYS].sort());
    expect(Object.keys(item.links).sort()).toEqual([...ITEM_LINK_KEYS].sort());
    expect(item.site.name).toBe(testData.siteName);
    expect(item.links.resolve).toContain(`/doi/`);
    expect(item.links.resolve).toContain(`site=${testData.siteName}`);
  });

  test('rejects unknown or private sites in the site filter', async () => {
    const prisma = await getPrismaClient();
    const privateSiteId = uuidv7();
    const now = new Date().toISOString();
    await prisma.site.create({
      data: {
        id: privateSiteId,
        name: `private-${privateSiteId}`,
        title: 'Private',
        private: true,
        date_created: now,
        date_modified: now,
        metadata: {},
        external: false,
        restricted: true,
        default_workflow: 'SIMPLE',
        slug_strategy: 'NONE',
      },
    });

    await expect(
      listSubmissionCatalog(
        testData.context,
        [],
        { site: [`private-${privateSiteId}`] },
        { page: 0, limit: 10 },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('global doi resolve — delivered package', () => {
  let testData: TestData;

  beforeEach(async () => {
    testData = await createTestData('ADMIN' as SiteRole);
  });

  test('resolves with site query param', async () => {
    const seed = await seedPublishedWorkWithDoi(testData, {});
    const dto = await resolveGlobalCatalogDoi(testData.context, seed.rawDoi, {
      siteName: testData.siteName,
    });
    expect(dto.submission_id).toBe(seed.submissionId);
    expect(dto.site.name).toBe(testData.siteName);
    expect(dto.links.self).toContain(`site=${testData.siteName}`);
    expect(Array.isArray(dto.versions)).toBe(true);
  });

  test('resolves without site query param using deterministic pick', async () => {
    const seed = await seedPublishedWorkWithDoi(testData, {});
    const dto = await resolveGlobalCatalogDoi(testData.context, seed.rawDoi);
    expect(dto.submission_id).toBe(seed.submissionId);
    expect(dto.site.name).toBe(testData.siteName);
  });

  test('picks newest publication when the same DOI exists on two public sites', async () => {
    const otherTestData = await createTestData('ADMIN' as SiteRole);
    const sharedDoi = `10.5555/${uuidv7()}`;
    const normDoi = doiUtil.normalize(sharedDoi) as string;
    await seedPublishedWorkWithDoi(testData, {
      datePublished: '2024-01-01',
      rawDoi: sharedDoi,
      normDoi,
    });
    const newer = await seedPublishedWorkWithDoi(otherTestData, {
      datePublished: '2099-01-01',
      rawDoi: sharedDoi,
      normDoi,
    });

    const dto = await resolveGlobalCatalogDoi(testData.context, sharedDoi);
    expect(dto.submission_id).toBe(newer.submissionId);
  });
});

interface DoiSeed {
  workId: string;
  workVersionId: string;
  submissionId: string;
  svId: string;
  rawDoi: string;
  normDoi: string;
  title: string;
  datePublished: string;
}

async function seedPublishedWorkWithDoi(
  testData: TestData,
  opts: {
    siteId?: string;
    datePublished?: string;
    rawDoi?: string;
    normDoi?: string;
  },
): Promise<DoiSeed> {
  const prisma = await getPrismaClient();
  const siteId = opts.siteId ?? testData.siteId;
  const workId = uuidv7();
  const workVersionId = uuidv7();
  const submissionId = uuidv7();
  const svId = uuidv7();
  const now = new Date().toISOString();
  const rawDoi = opts.rawDoi ?? `10.5555/${workId}`;
  const normDoi = opts.normDoi ?? (doiUtil.normalize(rawDoi) as string);
  const seed: DoiSeed = {
    workId,
    workVersionId,
    submissionId,
    svId,
    rawDoi,
    normDoi,
    title: `Catalog work ${workId}`,
    datePublished: opts.datePublished ?? '2024-03-01',
  };

  await prisma.work.create({
    data: {
      id: seed.workId,
      date_created: now,
      date_modified: now,
      doi: seed.normDoi,
      created_by: { connect: { id: testData.userId } },
    },
  });
  await prisma.workVersion.create({
    data: {
      id: seed.workVersionId,
      date_created: now,
      date_modified: now,
      title: seed.title,
      doi: seed.normDoi,
      authors: ['Ada Lovelace'],
      canonical: true,
      tags: [],
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
      tags: [],
      submission: { connect: { id: seed.submissionId } },
      work_version: { connect: { id: seed.workVersionId } },
      submitted_by: { connect: { id: testData.userId } },
    },
  });

  return seed;
}
