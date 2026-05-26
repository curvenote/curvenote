/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, beforeEach } from 'vitest';
import type { SiteRole } from '@curvenote/scms-db';
import { getPrismaClient } from '@curvenote/scms-server';
import { uuidv7 } from 'uuidv7';
import { createTestData, type TestData } from '../helpers/mocks';

/**
 * Integration tests for the `Submission.is_listed` denormalisation.
 *
 * The flag is maintained by the Postgres trigger
 * `submission_recompute_listing_fields` installed by migration
 * `20260526120000_add_submission_is_listed`. These tests exercise every
 * write path that should re-fire the trigger and assert the flag value
 * the trigger should compute.
 *
 * Notes for maintainers:
 * - The trigger only fires on `SubmissionVersion` writes; creating a
 *   `Submission` with no versions must leave `is_listed = false`.
 * - One test creates a `SubmissionVersion` via raw `prisma.create` rather
 *   than the app's helpers, proving the trigger fires regardless of which
 *   code path inserts the row.
 * - If these tests fail because `is_listed` is always false, the test
 *   database almost certainly has the column but not the trigger. This
 *   happens when the test DB is provisioned via `prisma db push`, which
 *   does not run migration SQL. Switch to `prisma migrate deploy` (or an
 *   equivalent that replays the migration file) for the test DB.
 */
describe('Submission is_listed denormalisation', () => {
  let testData: TestData;

  beforeEach(async () => {
    testData = await createTestData('ADMIN' as SiteRole);
  });

  async function readIsListed(submissionId: string): Promise<boolean> {
    const prisma = await getPrismaClient();
    const row = await prisma.submission.findUniqueOrThrow({
      where: { id: submissionId },
      select: { is_listed: true },
    });
    return row.is_listed;
  }

  async function makeVersion(
    submissionId: string,
    workVersionId: string,
    userId: string,
    status: string,
  ) {
    const prisma = await getPrismaClient();
    const now = new Date().toISOString();
    return prisma.submissionVersion.create({
      data: {
        id: uuidv7(),
        date_created: now,
        date_modified: now,
        status,
        submission: { connect: { id: submissionId } },
        work_version: { connect: { id: workVersionId } },
        submitted_by: { connect: { id: userId } },
      },
      select: { id: true, status: true },
    });
  }

  test('a submission with no versions is not listed', async () => {
    expect(await readIsListed(testData.submissionId)).toBe(false);
  });

  test('a submission with one DRAFT version is not listed', async () => {
    await makeVersion(
      testData.submissionId,
      testData.workVersionId,
      testData.userId,
      'DRAFT',
    );
    expect(await readIsListed(testData.submissionId)).toBe(false);
  });

  test('a submission with one INCOMPLETE version is not listed', async () => {
    await makeVersion(
      testData.submissionId,
      testData.workVersionId,
      testData.userId,
      'INCOMPLETE',
    );
    expect(await readIsListed(testData.submissionId)).toBe(false);
  });

  test('a submission with a PENDING version is listed', async () => {
    await makeVersion(
      testData.submissionId,
      testData.workVersionId,
      testData.userId,
      'PENDING',
    );
    expect(await readIsListed(testData.submissionId)).toBe(true);
  });

  test('transitioning the only version from DRAFT to PENDING flips is_listed to true', async () => {
    const prisma = await getPrismaClient();
    const v = await makeVersion(
      testData.submissionId,
      testData.workVersionId,
      testData.userId,
      'DRAFT',
    );
    expect(await readIsListed(testData.submissionId)).toBe(false);

    await prisma.submissionVersion.update({
      where: { id: v.id },
      data: { status: 'PENDING' },
    });
    expect(await readIsListed(testData.submissionId)).toBe(true);
  });

  test('adding a second INCOMPLETE version pulls is_listed back to false', async () => {
    await makeVersion(
      testData.submissionId,
      testData.workVersionId,
      testData.userId,
      'PENDING',
    );
    expect(await readIsListed(testData.submissionId)).toBe(true);

    await makeVersion(
      testData.submissionId,
      testData.workVersionId,
      testData.userId,
      'INCOMPLETE',
    );
    expect(await readIsListed(testData.submissionId)).toBe(false);
  });

  test('transitioning the INCOMPLETE version to PENDING restores is_listed to true', async () => {
    const prisma = await getPrismaClient();
    await makeVersion(
      testData.submissionId,
      testData.workVersionId,
      testData.userId,
      'PENDING',
    );
    const incomplete = await makeVersion(
      testData.submissionId,
      testData.workVersionId,
      testData.userId,
      'INCOMPLETE',
    );
    expect(await readIsListed(testData.submissionId)).toBe(false);

    await prisma.submissionVersion.update({
      where: { id: incomplete.id },
      data: { status: 'PENDING' },
    });
    expect(await readIsListed(testData.submissionId)).toBe(true);
  });

  test('deleting the only listed version returns is_listed to false', async () => {
    const v = await makeVersion(
      testData.submissionId,
      testData.workVersionId,
      testData.userId,
      'PENDING',
    );
    expect(await readIsListed(testData.submissionId)).toBe(true);

    const prisma = await getPrismaClient();
    await prisma.submissionVersion.delete({ where: { id: v.id } });
    expect(await readIsListed(testData.submissionId)).toBe(false);
  });

  test('non-status updates do not need to fire the trigger but never break the flag', async () => {
    const prisma = await getPrismaClient();
    const v = await makeVersion(
      testData.submissionId,
      testData.workVersionId,
      testData.userId,
      'PUBLISHED',
    );
    expect(await readIsListed(testData.submissionId)).toBe(true);

    await prisma.submissionVersion.update({
      where: { id: v.id },
      data: { date_modified: new Date().toISOString() },
    });
    expect(await readIsListed(testData.submissionId)).toBe(true);
  });

  test('trigger fires on raw inserts, not just app-helper-mediated writes', async () => {
    // Direct prisma.create with a non-DRAFT/INCOMPLETE status — bypasses any
    // helper logic. The flag must still flip to true via the trigger alone.
    await makeVersion(
      testData.submissionId,
      testData.workVersionId,
      testData.userId,
      'APPROVED',
    );
    expect(await readIsListed(testData.submissionId)).toBe(true);
  });
});
