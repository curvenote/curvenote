/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, beforeEach } from 'vitest';
import { TAG_LABEL_MAX_LENGTH } from '@curvenote/scms-core';
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

  test('the same name can be used on two different sites', async () => {
    const prisma = await getPrismaClient();
    const other = await createTestData('ADMIN' as SiteRole);
    const now = new Date().toISOString();

    const first = await prisma.tag.create({
      data: {
        id: uuidv7(),
        name: 'blog-post',
        label: 'Blog Post',
        date_created: now,
        site: { connect: { id: testData.siteId } },
      },
    });

    const second = await prisma.tag.create({
      data: {
        id: uuidv7(),
        name: 'blog-post',
        label: 'Blog Post',
        date_created: now,
        site: { connect: { id: other.siteId } },
      },
    });

    expect(second.id).not.toBe(first.id);
    expect(second.name).toBe(first.name);
  });
});

describe('assignTagToSubmission', () => {
  let testData: TestData;

  beforeEach(async () => {
    testData = await createTestData('ADMIN' as SiteRole);
  });

  test('creates the tag from a label and assigns it', async () => {
    const { tag, changed } = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { label: 'Blog Post' },
    });

    expect(tag).toMatchObject({ name: 'blog-post', label: 'Blog Post' });
    expect(changed).toBe(true);

    const assigned = await sites.tags.dbListTagsForSubmission(testData.submissionId);
    expect(assigned).toEqual([tag]);
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

    expect(second.tag.id).toBe(first.tag.id);
    const catalog = await sites.tags.dbListSiteTags(testData.siteId);
    expect(catalog).toHaveLength(1);
  });

  test('a repeated assignment does not duplicate the join row', async () => {
    const { tag } = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { label: 'Blog Post' },
    });
    const repeat = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { tagId: tag.id },
    });

    // The repeat is a no-op: callers key their side effects off `changed`.
    expect(repeat.changed).toBe(false);
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
        input: { tagId: foreign.tag.id },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  test('writes one SUBMISSION_TAGS_CHANGE activity per change', async () => {
    const prisma = await getPrismaClient();
    const { tag } = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { label: 'Blog Post' },
    });
    await sites.tags.removeTagFromSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      tagId: tag.id,
    });

    const activity = await prisma.activity.findMany({
      where: { submission_id: testData.submissionId, activity_type: 'SUBMISSION_TAGS_CHANGE' },
      // `date_created` is a millisecond-precision string; the add and the remove
      // above can land in the same millisecond, which leaves no deterministic
      // tiebreaker. `id` is a uuidv7, whose string form sorts lexically in
      // creation order, so order by `id` instead.
      orderBy: { id: 'asc' },
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
    const { tag } = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { label: 'Blog Post' },
    });

    const removed = await sites.tags.removeTagFromSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      tagId: tag.id,
    });

    expect(removed.changed).toBe(true);
    expect(await sites.tags.dbListTagsForSubmission(testData.submissionId)).toEqual([]);
    expect(await sites.tags.dbListSiteTags(testData.siteId)).toEqual([tag]);
  });

  test('a redundant remove reports changed false and writes no activity', async () => {
    const prisma = await getPrismaClient();
    const { tag } = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { label: 'Blog Post' },
    });
    const params = {
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      tagId: tag.id,
    };

    await sites.tags.removeTagFromSubmission(params);
    const second = await sites.tags.removeTagFromSubmission(params);

    expect(second.changed).toBe(false);
    expect(second.tag).toEqual(tag);
    const activity = await prisma.activity.count({
      where: { submission_id: testData.submissionId, activity_type: 'SUBMISSION_TAGS_CHANGE' },
    });
    expect(activity).toBe(2);
  });

  test('a change bumps Submission.date_modified', async () => {
    const prisma = await getPrismaClient();
    const before = await prisma.submission.findUniqueOrThrow({
      where: { id: testData.submissionId },
      select: { date_modified: true },
    });

    const { tag } = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { label: 'Blog Post' },
    });

    const after = await prisma.submission.findUniqueOrThrow({
      where: { id: testData.submissionId },
      select: { date_modified: true },
    });
    expect(after.date_modified > before.date_modified).toBe(true);
    expect(tag.name).toBe('blog-post');
  });

  test('rejects a label over the maximum length', async () => {
    await expect(
      sites.tags.assignTagToSubmission({
        siteId: testData.siteId,
        submissionId: testData.submissionId,
        userId: testData.userId,
        input: { label: 'a'.repeat(TAG_LABEL_MAX_LENGTH + 1) },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('HTTP-shaped tag contracts', () => {
  let testData: TestData;

  beforeEach(async () => {
    testData = await createTestData('ADMIN' as SiteRole);
  });

  test('sites.get returns a catalog containing the site tags', async () => {
    const { tag } = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { label: 'Blog Post' },
    });

    const site = await sites.get(testData.context, testData.siteName);
    expect(site.tags).toEqual([tag]);
  });

  test('published.get returns submission_tags and leaves version tags as string[]', async () => {
    await publishExistingSubmission(testData, ['preprint']);
    const { tag } = await sites.tags.assignTagToSubmission({
      siteId: testData.siteId,
      submissionId: testData.submissionId,
      userId: testData.userId,
      input: { label: 'Blog Post' },
    });

    const dto = await sites.submissions.published.get(testData.context, testData.workId);
    expect(dto).not.toBeNull();
    expect(dto!.submission_tags).toEqual([tag]);
    expect(dto!.tags).toEqual(['preprint']);
    expect(dto!.tags!.every((value) => typeof value === 'string')).toBe(true);
  });
});

async function publishExistingSubmission(testData: TestData, svTags: string[] = []): Promise<void> {
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();
  await prisma.submissionVersion.create({
    data: {
      id: uuidv7(),
      date_created: now,
      date_modified: now,
      date_published: now,
      status: 'PUBLISHED',
      tags: svTags,
      submission: { connect: { id: testData.submissionId } },
      work_version: { connect: { id: testData.workVersionId } },
      submitted_by: { connect: { id: testData.userId } },
    },
  });
  await prisma.submission.update({
    where: { id: testData.submissionId },
    data: { date_published: now },
  });
}
