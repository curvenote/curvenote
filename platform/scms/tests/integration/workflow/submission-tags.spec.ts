/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, beforeEach } from 'vitest';
import type { SiteRole } from '@curvenote/scms-db';
import { getPrismaClient } from '@curvenote/scms-server';
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
