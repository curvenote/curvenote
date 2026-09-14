/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, beforeEach } from 'vitest';
import type { SiteRole } from '@curvenote/scms-db';
import { getPrismaClient, sites } from '@curvenote/scms-server';
import { createTestData, type TestData } from '../helpers/mocks';
import { uuidv7 } from 'uuidv7';

describe('Submission tags schema', () => {
  let testData: TestData;

  beforeEach(async () => {
    testData = await createTestData('ADMIN' as SiteRole);
  });

  test('a tag is site scoped and joins a submission', async () => {
    const prisma = await getPrismaClient();
    const now = new Date().toISOString();

    const tag = await prisma.tag.create({
      data: {
        id: uuidv7(),
        name: 'blog-post',
        label: 'Blog Post',
        date_created: now,
        site: { connect: { id: testData.siteId } },
      },
    });

    await prisma.tagsInSubmissions.create({
      data: {
        id: uuidv7(),
        date_created: now,
        tag: { connect: { id: tag.id } },
        submission: { connect: { id: testData.submissionId } },
      },
    });

    const submission = await prisma.submission.findUniqueOrThrow({
      where: { id: testData.submissionId },
      select: { tags: { select: { tag: { select: { name: true, label: true } } } } },
    });

    expect(submission.tags).toEqual([{ tag: { name: 'blog-post', label: 'Blog Post' } }]);
  });

  test('the same name cannot be used twice on one site', async () => {
    const prisma = await getPrismaClient();
    const now = new Date().toISOString();
    const data = {
      name: 'blog-post',
      label: 'Blog Post',
      date_created: now,
      site: { connect: { id: testData.siteId } },
    };

    await prisma.tag.create({ data: { id: uuidv7(), ...data } });

    await expect(prisma.tag.create({ data: { id: uuidv7(), ...data } })).rejects.toMatchObject({
      code: 'P2002',
    });
  });
});

describe('assignTagToSubmission', () => {
  let testData: TestData;

  beforeEach(async () => {
    testData = await createTestData('ADMIN' as SiteRole);
  });

  test('creates the tag from a label and assigns it', async () => {
    const dto = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { label: 'Blog Post' },
    });

    expect(dto).toMatchObject({ name: 'blog-post', label: 'Blog Post' });

    const assigned = await sites.tags.dbListTagsForSubmission(testData.submissionId);
    expect(assigned).toEqual([dto]);
  });

  test('reuses an existing tag with the same derived name', async () => {
    const first = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { label: 'Blog Post' },
    });
    const second = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { label: 'blog post' },
    });

    expect(second.id).toBe(first.id);
    const catalog = await sites.tags.dbListSiteTags(testData.siteId);
    expect(catalog).toHaveLength(1);
  });

  test('a repeated assignment does not duplicate the join row', async () => {
    const dto = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { label: 'Blog Post' },
    });
    await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { tagId: dto.id },
    });

    const assigned = await sites.tags.dbListTagsForSubmission(testData.submissionId);
    expect(assigned).toHaveLength(1);
  });

  test('rejects a short label', async () => {
    // `httpError` rejects with a Response, not an Error, so assert on status.
    await expect(
      sites.tags.assignTagToSubmission({
        siteId: testData.siteId,
        submissionId: testData.submissionId,
        userId: testData.userId,
        input: { label: 'ab' },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  test('rejects a tag from another site', async () => {
    const other = await createTestData('ADMIN' as SiteRole);
    const foreign = await sites.tags.assignTagToSubmission({
      siteId: other.siteId,
      submissionId: other.submissionId,
      userId: other.userId,
      input: { label: 'Blog Post' },
    });

    await expect(
      sites.tags.assignTagToSubmission({
        siteId: testData.siteId,
        submissionId: testData.submissionId,
        userId: testData.userId,
        input: { tagId: foreign.id },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  test('writes one SUBMISSION_TAGS_CHANGE activity per change', async () => {
    const prisma = await getPrismaClient();
    const dto = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { label: 'Blog Post' },
    });
    await sites.tags.removeTagFromSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      tagId: dto.id,
    });

    const activity = await prisma.activity.findMany({
      where: { submission_id: testData.submissionId, activity_type: 'SUBMISSION_TAGS_CHANGE' },
      orderBy: { date_created: 'asc' },
      select: { data: true },
    });

    expect(activity).toHaveLength(2);
    expect(activity[0].data).toMatchObject({ action: 'added', tag: { name: 'blog-post' } });
    expect(activity[1].data).toMatchObject({ action: 'removed', tag: { name: 'blog-post' } });
  });
});

describe('removeTagFromSubmission', () => {
  let testData: TestData;

  beforeEach(async () => {
    testData = await createTestData('ADMIN' as SiteRole);
  });

  test('removes the assignment and keeps the tag in the catalog', async () => {
    const dto = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { label: 'Blog Post' },
    });

    await sites.tags.removeTagFromSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      tagId: dto.id,
    });

    expect(await sites.tags.dbListTagsForSubmission(testData.submissionId)).toEqual([]);
    expect(await sites.tags.dbListSiteTags(testData.siteId)).toEqual([dto]);
  });
});
