// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assembleDeposit: vi.fn(),
  writePrivateXml: vi.fn(),
  generateFreeDoi: vi.fn(),
  insertJobRow: vi.fn(),
  dispatchJob: vi.fn(),
  writeRegistrationActivity: vi.fn(),
  failDeposit: vi.fn(),
  failJob: vi.fn(),
}));
vi.mock('../deposit/assemble.server.js', () => ({ assembleDeposit: mocks.assembleDeposit }));
vi.mock('../deposit/storage.server.js', () => ({
  writePrivateXml: mocks.writePrivateXml,
  depositXmlKey: (f: string) => `crossref/deposits/${f}`,
}));
vi.mock('./doi.server.js', () => ({ generateFreeDoi: mocks.generateFreeDoi }));
vi.mock('../jobs/schedule.server.js', () => ({
  insertJobRow: mocks.insertJobRow,
  dispatchJob: mocks.dispatchJob,
}));
vi.mock('./result.server.js', () => ({ failDeposit: mocks.failDeposit }));
vi.mock('../jobs/handler.server.js', () => ({ fail: mocks.failJob }));
vi.mock('./activity.server.js', () => ({
  writeRegistrationActivity: mocks.writeRegistrationActivity,
}));

import { startRegistration } from './start.server.js';

const SITE = 'site-a';
const PREFIX = '10.9999';
const DOI = '10.9999/abcd1234';
const IN_PROGRESS = { ok: false, status: 409, error: 'A registration is already in progress.' };
const NOT_ACTIVE = {
  ok: false,
  status: 409,
  error: 'The site is not set up for DOI registration.',
};

/**
 * Builds the root Prisma double and a *distinct* `tx` object that shares the same model mocks, so
 * the helper-function arguments (`insertJobRow`, `writeRegistrationActivity`) can tell "the
 * transaction client" (correct) from "the root client" (a bug). `$transaction` always passes `tx`.
 */
function prisma() {
  const models = {
    submission: { findFirst: vi.fn(), findUnique: vi.fn() },
    siteDoiConfig: {
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    doiRegistration: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    doiDeposit: { create: vi.fn() },
  };
  const tx = { ...models };
  const p: any = { ...models, $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)) };
  return { p, tx: tx as any };
}

const creds = {
  host: 'https://doi.crossref.org',
  depositorEmail: 'doi@curvenote.com',
  password: 'x',
  prefix: '10.62329',
  role: 'curv',
  resourceUrlBase: 'https://example.com/doi',
} as any;
const published = { id: 'sv-1' };

let p: any;
let tx: any;
beforeEach(() => {
  vi.clearAllMocks();
  ({ p, tx } = prisma());
  p.submission.findFirst.mockResolvedValue({ id: 'sub-1', doi: null, versions: [published] });
  p.submission.findUnique.mockResolvedValue({
    kind: { name: 'Article', content: {}, doi_content_type: 'PREPRINT' },
  });
  p.siteDoiConfig.findUnique.mockResolvedValue({ prefix: PREFIX, status: 'ACTIVE' });
  p.doiRegistration.findUnique.mockResolvedValue(null);
  p.doiRegistration.create.mockResolvedValue({ id: 'reg-1' });
  mocks.generateFreeDoi.mockResolvedValue(DOI);
  mocks.assembleDeposit.mockResolvedValue({
    xml: '<doi_batch/>',
    contentType: 'PREPRINT',
    issues: [],
    doi: DOI,
  });
  mocks.insertJobRow.mockResolvedValue({ jobId: 'job-1' });
});

const run = () =>
  startRegistration(
    {} as any,
    { prisma: p, creds },
    { siteId: SITE, submissionId: 'sub-1', userId: 'u1' },
  );

function expectNothingWritten() {
  expect(p.$transaction).not.toHaveBeenCalled();
  expect(mocks.writePrivateXml).not.toHaveBeenCalled();
  expect(mocks.dispatchJob).not.toHaveBeenCalled();
}

function expectNothingCreated() {
  expect(p.doiRegistration.create).not.toHaveBeenCalled();
  expect(p.doiRegistration.updateMany).not.toHaveBeenCalled();
  expect(mocks.insertJobRow).not.toHaveBeenCalled();
  expect(p.doiDeposit.create).not.toHaveBeenCalled();
  expect(mocks.writeRegistrationActivity).not.toHaveBeenCalled();
  expect(mocks.dispatchJob).not.toHaveBeenCalled();
}

function existing(status: string, doi = DOI, prefix = PREFIX) {
  p.doiRegistration.findUnique.mockResolvedValueOnce({ id: 'reg-1', status, doi, prefix });
}

describe('startRegistration: reads', () => {
  it('only looks the submission up on the current site and its latest published version', async () => {
    p.submission.findFirst.mockResolvedValue(null);

    expect(await run()).toEqual({ ok: false, status: 404, error: 'Submission not found.' });
    expect(p.submission.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1', site_id: SITE },
        select: expect.objectContaining({
          versions: expect.objectContaining({
            where: { status: 'PUBLISHED' },
            orderBy: { date_created: 'desc' },
            take: 1,
          }),
        }),
      }),
    );
    expect(mocks.assembleDeposit).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it('refuses with 409 when no version is published', async () => {
    p.submission.findFirst.mockResolvedValue({ id: 'sub-1', doi: null, versions: [] });

    expect(await run()).toEqual({
      ok: false,
      status: 409,
      error: 'Publish this submission to register a DOI.',
    });
    expect(mocks.assembleDeposit).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it('refuses with 409 when the submission already has a DOI', async () => {
    p.submission.findFirst.mockResolvedValue({ id: 'sub-1', doi: '10.1/x', versions: [published] });

    expect(await run()).toEqual({
      ok: false,
      status: 409,
      error: 'This submission already has a DOI.',
    });
    expect(mocks.assembleDeposit).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it('registers when only the work arrived with a DOI', async () => {
    p.submission.findFirst.mockResolvedValue({
      id: 'sub-1',
      doi: null,
      versions: [{ ...published, work_version: { doi: '10.1/x', work: { doi: '10.1/y' } } }],
    });

    expect(await run()).toEqual({ ok: true, doi: DOI });
  });

  it.each([
    ['SUBMITTING', 'A registration is already in progress.'],
    ['REGISTERED', 'This submission already has a DOI.'],
  ])('refuses %s without bumping occ', async (status, error) => {
    existing(status);

    expect(await run()).toEqual({ ok: false, status: 409, error });
    expect(p.siteDoiConfig.updateMany).not.toHaveBeenCalled();
    expect(mocks.assembleDeposit).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it.each([[{ prefix: PREFIX, status: 'PENDING_ROLE' }], [null]])(
    'refuses when the site is not ACTIVE (%j)',
    async (site) => {
      p.siteDoiConfig.findUnique.mockResolvedValue(site);

      expect(await run()).toEqual(NOT_ACTIVE);
      expect(mocks.assembleDeposit).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it('returns the blocking issues and writes nothing', async () => {
    const issues = [{ severity: 'blocking', code: 'no_title', message: 'Title is missing.' }];
    mocks.assembleDeposit.mockResolvedValue({ issues, doi: DOI });

    expect(await run()).toEqual({
      ok: false,
      status: 400,
      error: 'The deposit is not ready.',
      issues,
    });
    expectNothingWritten();
  });
});

describe('startRegistration: write', () => {
  it('first start: assembles under the site prefix, stores the XML, creates SUBMITTING + PENDING + job + activity in one transaction, then dispatches', async () => {
    let dispatchedInsideTx: boolean | undefined;
    p.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const committed = await fn(tx);
      dispatchedInsideTx = mocks.dispatchJob.mock.calls.length > 0;
      return committed;
    });

    const result = await run();

    expect(result).toEqual({ ok: true, doi: DOI });
    const depositId = tx.doiDeposit.create.mock.calls[0][0].data.id;
    expect(depositId).toEqual(expect.any(String));
    const xmlPath = `crossref/deposits/${depositId}.xml`;

    // The site's own prefix, never deps.creds.prefix (Curvenote's global prefix).
    expect(mocks.generateFreeDoi).toHaveBeenCalledWith(p, PREFIX);
    expect(mocks.assembleDeposit).toHaveBeenCalledWith({}, 'sv-1', {
      doi: DOI,
      batchId: depositId,
      depositorEmail: creds.depositorEmail,
      resourceUrlBase: creds.resourceUrlBase,
    });
    expect(mocks.writePrivateXml).toHaveBeenCalledWith({}, xmlPath, '<doi_batch/>');
    expect(p.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.siteDoiConfig.updateMany).toHaveBeenCalledWith({
      where: { site_id: SITE, status: 'ACTIVE' },
      data: { occ: { increment: 1 } },
    });
    expect(tx.doiRegistration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SUBMITTING',
          doi: DOI,
          prefix: PREFIX,
          content_type: 'PREPRINT',
          submission_id: 'sub-1',
          site_id: SITE,
          created_by_id: 'u1',
        }),
      }),
    );
    expect(mocks.insertJobRow).toHaveBeenCalledWith(tx, {
      jobType: 'CROSSREF_DEPOSIT',
      payload: { depositId, siteId: SITE, attempt: 1 },
      invokedById: 'u1',
    });
    expect(mocks.insertJobRow.mock.calls[0][0]).not.toBe(p);
    expect(tx.doiDeposit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: depositId,
          registration_id: 'reg-1',
          submission_version_id: 'sv-1',
          file_name: `${depositId}.xml`,
          doi_batch_id: depositId,
          xml_path: xmlPath,
          status: 'PENDING',
          job_id: 'job-1',
        }),
      }),
    );
    expect(mocks.writeRegistrationActivity).toHaveBeenCalledWith(tx, {
      type: 'DOI_REGISTRATION_STARTED',
      siteId: SITE,
      submissionId: 'sub-1',
      submissionVersionId: 'sv-1',
      userId: 'u1',
      data: { doi: DOI, depositId },
    });
    expect(mocks.writeRegistrationActivity.mock.calls[0][0]).not.toBe(p);
    expect(mocks.dispatchJob).toHaveBeenCalledWith('job-1', 'CROSSREF_DEPOSIT');
    // Dispatched only after the transaction callback resolved (i.e. after commit).
    expect(dispatchedInsideTx).toBe(false);
    expect(mocks.writeRegistrationActivity.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.dispatchJob.mock.invocationCallOrder[0],
    );
  });

  it('fails the attempt and the job when dispatch throws after the commit, so Retry is offered', async () => {
    mocks.dispatchJob.mockRejectedValueOnce(
      new Error('relation "_JobQueueDrainConfig" does not exist'),
    );
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await run()).toEqual({
      ok: false,
      status: 503,
      error: 'The DOI registration could not be queued. Try again.',
    });
    const depositId = tx.doiDeposit.create.mock.calls[0][0].data.id;
    expect(mocks.failDeposit).toHaveBeenCalledWith(p, {
      deposit: {
        id: depositId,
        submission_version_id: 'sv-1',
        registration: {
          id: 'reg-1',
          doi: DOI,
          submission_id: 'sub-1',
          site_id: SITE,
        },
      },
      error: 'dispatch_failed',
      userId: 'u1',
    });
    expect(mocks.failJob).toHaveBeenCalledWith('job-1', expect.stringContaining('dispatch_failed'));
    error.mockRestore();
  });

  it('still answers 503 when failing the attempt after a dispatch error also throws', async () => {
    mocks.dispatchJob.mockRejectedValueOnce(new Error('queue down'));
    mocks.failDeposit.mockRejectedValueOnce(new Error('db down'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await run()).toMatchObject({ ok: false, status: 503 });
    error.mockRestore();
  });

  it('FAILED retry reuses its DOI and flips it to SUBMITTING', async () => {
    existing('FAILED');

    expect(await run()).toEqual({ ok: true, doi: DOI });
    expect(mocks.generateFreeDoi).not.toHaveBeenCalled();
    expect(tx.doiRegistration.updateMany).toHaveBeenCalledWith({
      where: { id: 'reg-1', doi: DOI, status: { in: ['FAILED', 'DRAFT'] } },
      data: expect.objectContaining({
        status: 'SUBMITTING',
        doi: DOI,
        prefix: PREFIX,
        content_type: 'PREPRINT',
      }),
    });
    expect(tx.doiRegistration.create).not.toHaveBeenCalled();
    expect(mocks.dispatchJob).toHaveBeenCalledWith('job-1', 'CROSSREF_DEPOSIT');
  });

  it('FAILED under an old prefix gets a new DOI and writes doi and prefix', async () => {
    existing('FAILED', '10.1111/old', '10.1111');

    expect(await run()).toEqual({ ok: true, doi: DOI });
    expect(mocks.generateFreeDoi).toHaveBeenCalledWith(p, PREFIX);
    expect(mocks.assembleDeposit).toHaveBeenCalledWith(
      {},
      'sv-1',
      expect.objectContaining({ doi: DOI }),
    );
    expect(tx.doiRegistration.updateMany).toHaveBeenCalledWith({
      where: { id: 'reg-1', doi: '10.1111/old', status: { in: ['FAILED', 'DRAFT'] } },
      data: expect.objectContaining({ status: 'SUBMITTING', doi: DOI, prefix: PREFIX }),
    });
    expect(tx.doiRegistration.create).not.toHaveBeenCalled();
  });

  it('FAILED retry that loses the race writes nothing else', async () => {
    existing('FAILED');
    tx.doiRegistration.updateMany.mockResolvedValue({ count: 0 });

    expect(await run()).toEqual(IN_PROGRESS);
    expect(mocks.insertJobRow).not.toHaveBeenCalled();
    expect(tx.doiDeposit.create).not.toHaveBeenCalled();
    expect(mocks.writeRegistrationActivity).not.toHaveBeenCalled();
    expect(mocks.dispatchJob).not.toHaveBeenCalled();
  });

  it('refuses when the site stops being ACTIVE before the write', async () => {
    tx.siteDoiConfig.updateMany.mockResolvedValue({ count: 0 });

    expect(await run()).toEqual(NOT_ACTIVE);
    expectNothingCreated();
  });

  it('refuses when the prefix changed between the read and the write', async () => {
    p.siteDoiConfig.findUnique
      .mockResolvedValueOnce({ prefix: PREFIX, status: 'ACTIVE' })
      .mockResolvedValueOnce({ prefix: '10.2222', status: 'ACTIVE' });

    expect(await run()).toEqual({
      ok: false,
      status: 409,
      error: "The site's DOI prefix changed. Try again.",
    });
    expectNothingCreated();
  });

  it('turns a unique violation into 409 when a registration now exists', async () => {
    tx.doiRegistration.create.mockRejectedValue({ code: 'P2002' });
    p.doiRegistration.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'reg-2' });

    expect(await run()).toEqual(IN_PROGRESS);
    expect(p.doiRegistration.findUnique).toHaveBeenLastCalledWith({
      where: { submission_id: 'sub-1' },
      select: { id: true },
    });
    expect(mocks.dispatchJob).not.toHaveBeenCalled();
  });

  it('rethrows a unique violation when no registration exists', async () => {
    const collision = { code: 'P2002' };
    tx.doiRegistration.create.mockRejectedValue(collision);
    p.doiRegistration.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(run()).rejects.toBe(collision);
    expect(p.doiRegistration.findUnique).toHaveBeenCalledTimes(2);
    expect(mocks.dispatchJob).not.toHaveBeenCalled();
  });
});

describe('startRegistration: kind eligibility', () => {
  const notEligible =
    'Submissions of kind "Blog" can\'t receive DOIs. A site admin can enable it in DOI Registration.';

  it('refuses when the kind stopped being eligible after the deposit was assembled', async () => {
    p.submission.findUnique.mockResolvedValue({
      kind: { name: 'Blog', content: {}, doi_content_type: null },
    });

    expect(await run()).toEqual({ ok: false, status: 409, error: notEligible });
    expectNothingCreated();
  });

  it('refuses when the kind maps to another type than the assembled deposit', async () => {
    mocks.assembleDeposit.mockResolvedValue({
      xml: '<doi_batch/>',
      contentType: 'JOURNAL_ARTICLE',
      issues: [],
      doi: DOI,
    });

    expect(await run()).toEqual({
      ok: false,
      status: 409,
      error: "The Submission Kind's DOI content type changed. Try again.",
    });
    expectNothingCreated();
  });

  it('refuses a DOI content type Curvenote does not have', async () => {
    p.submission.findUnique.mockResolvedValue({
      kind: { name: 'Blog', content: {}, doi_content_type: 'JOURNAL_ARTICLE' },
    });

    expect(await run()).toEqual({ ok: false, status: 409, error: notEligible });
    expectNothingCreated();
  });

  it('answers a Retry on an ineligible kind with the not-eligible issue, writing nothing', async () => {
    existing('FAILED');
    mocks.assembleDeposit.mockResolvedValue({
      issues: [{ severity: 'blocking', code: 'kind_not_eligible', message: notEligible }],
      doi: DOI,
    });

    const result = await run();

    expect(result).toMatchObject({
      ok: false,
      status: 400,
      issues: [expect.objectContaining({ code: 'kind_not_eligible' })],
    });
    expectNothingWritten();
  });
});
