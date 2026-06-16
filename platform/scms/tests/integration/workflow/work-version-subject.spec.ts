/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, beforeEach } from 'vitest';
import type { SiteRole } from '@curvenote/scms-db';
import { fetchSubmissionIdsBySubject, getPrismaClient } from '@curvenote/scms-server';
import { uuidv7 } from 'uuidv7';
import { createTestData, type TestData } from '../helpers/mocks';

function subjectMetadata(subject: string) {
  return {
    'frontmatter.myst': { subject },
  };
}

async function seedSubmissionWithSubject(
  testData: TestData,
  opts: {
    subject: string;
    siteId?: string;
    status?: string;
  },
): Promise<{ submissionId: string; workVersionId: string }> {
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();
  const siteId = opts.siteId ?? testData.siteId;
  const status = opts.status ?? 'PUBLISHED';
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
      title: `Subject seed ${submissionId}`,
      authors: [],
      metadata: subjectMetadata(opts.subject),
      work: { connect: { id: workId } },
    },
  });
  await prisma.submission.create({
    data: {
      id: submissionId,
      date_created: now,
      date_modified: now,
      site: { connect: { id: siteId } },
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
      status,
      submission: { connect: { id: submissionId } },
      work_version: { connect: { id: workVersionId } },
      submitted_by: { connect: { id: testData.userId } },
    },
  });

  return { submissionId, workVersionId };
}

describe('fetchSubmissionIdsBySubject', () => {
  let testData: TestData;

  beforeEach(async () => {
    testData = await createTestData('ADMIN' as SiteRole);
  });

  test('matches subject case- and whitespace-insensitively', async () => {
    const { submissionId } = await seedSubmissionWithSubject(testData, {
      subject: '  Neuroscience ',
    });

    const ids = await fetchSubmissionIdsBySubject(testData.siteId, 'neuroscience', 'PUBLISHED');
    expect(ids).toEqual([submissionId]);
  });

  test('returns each submission once when multiple published versions match', async () => {
    const prisma = await getPrismaClient();
    const now = new Date().toISOString();
    const workId = uuidv7();
    const submissionId = uuidv7();
    const firstWorkVersionId = uuidv7();
    const secondWorkVersionId = uuidv7();

    await prisma.work.create({
      data: {
        id: workId,
        date_created: now,
        date_modified: now,
        created_by: { connect: { id: testData.userId } },
      },
    });
    for (const workVersionId of [firstWorkVersionId, secondWorkVersionId]) {
      await prisma.workVersion.create({
        data: {
          id: workVersionId,
          date_created: now,
          date_modified: now,
          title: `Version ${workVersionId}`,
          authors: [],
          metadata: subjectMetadata('Genomics'),
          work: { connect: { id: workId } },
        },
      });
    }
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
    for (const workVersionId of [firstWorkVersionId, secondWorkVersionId]) {
      await prisma.submissionVersion.create({
        data: {
          id: uuidv7(),
          date_created: now,
          date_modified: now,
          status: 'PUBLISHED',
          submission: { connect: { id: submissionId } },
          work_version: { connect: { id: workVersionId } },
          submitted_by: { connect: { id: testData.userId } },
        },
      });
    }

    const ids = await fetchSubmissionIdsBySubject(testData.siteId, 'genomics', 'PUBLISHED');
    expect(ids).toEqual([submissionId]);
  });

  test('scopes to the requested submission version status', async () => {
    const published = await seedSubmissionWithSubject(testData, {
      subject: 'Microbiology',
      status: 'PUBLISHED',
    });
    await seedSubmissionWithSubject(testData, {
      subject: 'Microbiology',
      status: 'DRAFT',
    });

    const ids = await fetchSubmissionIdsBySubject(testData.siteId, 'microbiology', 'PUBLISHED');
    expect(ids).toEqual([published.submissionId]);
  });

  test('scopes to the requested site', async () => {
    const prisma = await getPrismaClient();
    const now = new Date().toISOString();
    const otherSiteId = uuidv7();
    await prisma.site.create({
      data: {
        id: otherSiteId,
        name: `other-site-${otherSiteId}`,
        title: 'Other Site',
        private: false,
        date_created: now,
        date_modified: now,
        metadata: {},
        external: false,
        restricted: true,
        default_workflow: 'SIMPLE',
        slug_strategy: 'NONE',
      },
    });

    const onSite = await seedSubmissionWithSubject(testData, { subject: 'Oncology' });
    await seedSubmissionWithSubject(testData, { subject: 'Oncology', siteId: otherSiteId });

    const ids = await fetchSubmissionIdsBySubject(testData.siteId, 'oncology', 'PUBLISHED');
    expect(ids).toEqual([onSite.submissionId]);
  });

  test('returns an empty list when no subject matches', async () => {
    await seedSubmissionWithSubject(testData, { subject: 'Cardiology' });

    const ids = await fetchSubmissionIdsBySubject(testData.siteId, 'no-such-subject', 'PUBLISHED');
    expect(ids).toEqual([]);
  });
});
