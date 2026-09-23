// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  deposit: vi.fn(),
  readPrivateXml: vi.fn(),
  failDeposit: vi.fn(),
  insertJobRow: vi.fn(),
  dispatchJob: vi.fn(),
  dbUpdateJob: vi.fn(async (id: string, data: any) => ({ id, ...data })),
  prisma: {} as any,
}));
vi.mock('../crossref/deposit.server.js', () => ({ deposit: mocks.deposit }));
vi.mock('../crossref/client.server.js', async (orig) => ({
  ...(await orig<any>()),
  crossrefCredentialsFromConfig: () => ({
    host: 'h',
    depositorEmail: 'doi@curvenote.com',
    password: 'p',
    prefix: '10.62329',
    role: 'curv',
    resourceUrlBase: 'https://doi.example.com',
  }),
}));
vi.mock('../deposit/storage.server.js', () => ({
  readPrivateXml: mocks.readPrivateXml,
}));
vi.mock('../registration/result.server.js', () => ({
  failDeposit: mocks.failDeposit,
}));
vi.mock('./schedule.server.js', () => ({
  insertJobRow: mocks.insertJobRow,
  dispatchJob: mocks.dispatchJob,
}));
vi.mock('@curvenote/scms-server', () => ({
  getPrismaClient: async () => mocks.prisma,
  dbUpdateJob: mocks.dbUpdateJob,
}));

import { CrossrefError } from '../crossref/client.server.js';
import { crossrefDepositHandler } from './crossrefDeposit.server.js';

const row = () => ({
  id: 'dep-1',
  status: 'PENDING',
  file_name: 'dep-1.xml',
  xml_path: 'crossref/deposits/dep-1.xml',
  date_created: new Date().toISOString(),
  submission_version_id: 'sv-1',
  registration: {
    id: 'reg-1',
    doi: '10.62329/abcd1234',
    status: 'SUBMITTING',
    submission_id: 'sub-1',
    site_id: 'site-a',
    created_by_id: 'u1',
  },
});
const job = {
  id: 'job-1',
  job_type: 'CROSSREF_DEPOSIT',
  payload: { depositId: 'dep-1', siteId: 'site-a', attempt: 1 },
} as any;
const ctx = { $config: {} } as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma = {
    doiDeposit: {
      findUnique: vi.fn().mockResolvedValue(row()),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
    },
    siteDoiConfig: { findUnique: vi.fn().mockResolvedValue({ role: null, status: 'ACTIVE' }) },
  };
  mocks.prisma.$transaction = vi.fn(async (fn: any) => fn(mocks.prisma));
  mocks.readPrivateXml.mockResolvedValue('<doi_batch/>');
  mocks.insertJobRow.mockResolvedValue({ jobId: 'job-2', scheduled: false });
  mocks.failDeposit.mockResolvedValue('applied');
});

describe('crossrefDepositHandler', () => {
  it('posts with the site role or the Curvenote role and marks the attempt QUEUED, without a poll', async () => {
    mocks.deposit.mockResolvedValue({ state: 'received' });
    const out = await crossrefDepositHandler(ctx, job);
    expect(mocks.deposit).toHaveBeenCalledWith(expect.objectContaining({ prefix: '10.62329' }), {
      role: 'curv',
      fileName: 'dep-1.xml',
      xml: '<doi_batch/>',
    });
    expect(mocks.prisma.doiDeposit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dep-1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'QUEUED' }),
      }),
    );
    // No poll job is inserted.
    expect(mocks.insertJobRow).not.toHaveBeenCalled();
    expect(mocks.dispatchJob).not.toHaveBeenCalled();
    expect(out).toMatchObject({ status: 'COMPLETED' });
  });

  it('uses the custom role when the site has one', async () => {
    mocks.prisma.siteDoiConfig.findUnique.mockResolvedValue({ role: 'elms', status: 'ACTIVE' });
    mocks.deposit.mockResolvedValue({ state: 'received' });
    await crossrefDepositHandler(ctx, job);
    expect(mocks.deposit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ role: 'elms' }),
    );
  });

  it('reschedules itself on a 5xx and on a timeout without throwing', async () => {
    mocks.deposit.mockRejectedValue(new CrossrefError('Crossref deposit answered 503', 503));
    mocks.insertJobRow.mockResolvedValue({ jobId: 'job-3', scheduled: true });
    const out = await crossrefDepositHandler(ctx, job);
    expect(mocks.insertJobRow).toHaveBeenCalledWith(
      mocks.prisma,
      expect.objectContaining({
        jobType: 'CROSSREF_DEPOSIT',
        payload: { depositId: 'dep-1', siteId: 'site-a', attempt: 2 },
        scheduledAt: expect.any(String),
      }),
    );
    // job_id is written only after the job row exists, and only by id: the guarded updateMany
    // that gates the reschedule must not itself create a SCHEDULED job nobody should run.
    expect(mocks.prisma.doiDeposit.update).toHaveBeenCalledWith({
      where: { id: 'dep-1' },
      data: { job_id: 'job-3' },
    });
    expect(mocks.dispatchJob).not.toHaveBeenCalled();
    expect(out).toMatchObject({
      status: 'COMPLETED',
      message: expect.stringMatching(/rescheduled/),
    });
    mocks.deposit.mockRejectedValue(new CrossrefError('timed out'));
    const timeoutOut = await crossrefDepositHandler(ctx, job);
    expect(timeoutOut).toMatchObject({ status: 'COMPLETED' });
    expect(mocks.insertJobRow).toHaveBeenCalledWith(
      mocks.prisma,
      expect.objectContaining({ jobType: 'CROSSREF_DEPOSIT' }),
    );
    expect(mocks.failDeposit).not.toHaveBeenCalled();
  });

  it('reschedules on a 429 without failing the deposit', async () => {
    mocks.deposit.mockRejectedValue(new CrossrefError('Crossref deposit answered 429', 429));
    const out = await crossrefDepositHandler(ctx, job);
    expect(mocks.insertJobRow).toHaveBeenCalledWith(
      mocks.prisma,
      expect.objectContaining({ jobType: 'CROSSREF_DEPOSIT' }),
    );
    expect(mocks.failDeposit).not.toHaveBeenCalled();
    expect(out).toMatchObject({
      status: 'COMPLETED',
      message: expect.stringMatching(/rescheduled/),
    });
  });

  it('fails the attempt after the 72h horizon instead of rescheduling', async () => {
    mocks.prisma.doiDeposit.findUnique.mockResolvedValue({
      ...row(),
      date_created: new Date(Date.now() - 73 * 3600 * 1000).toISOString(),
    });
    mocks.deposit.mockRejectedValue(new CrossrefError('Crossref deposit answered 503', 503));
    const out = await crossrefDepositHandler(ctx, job);
    expect(mocks.failDeposit).toHaveBeenCalledWith(mocks.prisma, {
      deposit: expect.objectContaining({ id: 'dep-1' }),
      error: 'no_deposit_after_72h',
    });
    expect(mocks.insertJobRow).not.toHaveBeenCalled();
    expect(out).toMatchObject({ status: 'COMPLETED' });
  });

  it('fails the attempt on 401 and leaves the site alone', async () => {
    mocks.deposit.mockResolvedValue({ state: 'unauthorized' });
    const out = await crossrefDepositHandler(ctx, job);
    expect(mocks.failDeposit).toHaveBeenCalledWith(mocks.prisma, {
      deposit: expect.objectContaining({ id: 'dep-1' }),
      error: 'site_credentials_rejected',
    });
    expect(out).toMatchObject({ status: 'COMPLETED' });
  });

  it('fails the attempt on a non-retryable Crossref answer instead of throwing', async () => {
    mocks.deposit.mockRejectedValue(new CrossrefError('Crossref deposit was not received', 200));
    const out = await crossrefDepositHandler(ctx, job);
    expect(mocks.failDeposit).toHaveBeenCalledWith(mocks.prisma, {
      deposit: expect.objectContaining({ id: 'dep-1' }),
      error: 'Crossref deposit was not received',
    });
    expect(out).toMatchObject({ status: 'COMPLETED' });
  });

  it('fails the attempt without posting when the site is no longer ACTIVE', async () => {
    mocks.prisma.siteDoiConfig.findUnique.mockResolvedValue({
      role: 'elms',
      status: 'PENDING_ROLE',
    });
    await crossrefDepositHandler(ctx, job);
    expect(mocks.deposit).not.toHaveBeenCalled();
    expect(mocks.failDeposit).toHaveBeenCalledWith(
      mocks.prisma,
      expect.objectContaining({ error: 'site_not_active' }),
    );
  });

  it('fails the attempt with internal_error and rethrows on an unexpected error', async () => {
    const boom = new Error('storage down');
    mocks.readPrivateXml.mockRejectedValue(boom);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(crossrefDepositHandler(ctx, job)).rejects.toBe(boom);
    expect(mocks.failDeposit).toHaveBeenCalledWith(mocks.prisma, {
      deposit: expect.objectContaining({ id: 'dep-1' }),
      error: 'internal_error',
    });
    error.mockRestore();
  });

  it('still rethrows the original error when failing the attempt also throws', async () => {
    const boom = new Error('storage down');
    mocks.readPrivateXml.mockRejectedValue(boom);
    mocks.failDeposit.mockRejectedValue(new Error('db down'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(crossrefDepositHandler(ctx, job)).rejects.toBe(boom);
    error.mockRestore();
  });

  it('completes as a no-op when the attempt is not PENDING', async () => {
    mocks.prisma.doiDeposit.findUnique.mockResolvedValue({ ...row(), status: 'QUEUED' });
    const out = await crossrefDepositHandler(ctx, job);
    expect(mocks.deposit).not.toHaveBeenCalled();
    expect(out).toMatchObject({ status: 'COMPLETED', message: expect.stringMatching(/no-op/) });
  });

  it('marks the job FAILED when the deposit row is missing', async () => {
    mocks.prisma.doiDeposit.findUnique.mockResolvedValue(null);
    expect(await crossrefDepositHandler(ctx, job)).toMatchObject({ status: 'FAILED' });
  });

  it('completes without changes when another delivery already marked the attempt QUEUED', async () => {
    mocks.deposit.mockResolvedValue({ state: 'received' });
    mocks.prisma.doiDeposit.updateMany.mockResolvedValue({ count: 0 });
    const out = await crossrefDepositHandler(ctx, job);
    expect(out).toMatchObject({
      status: 'COMPLETED',
      message: expect.stringContaining('already advanced'),
    });
  });

  it('does not insert a reschedule job when another delivery already advanced the attempt', async () => {
    mocks.prisma.doiDeposit.updateMany.mockResolvedValue({ count: 0 });
    mocks.deposit.mockRejectedValue(new CrossrefError('Crossref deposit answered 503', 503));
    const out = await crossrefDepositHandler(ctx, job);
    // No SCHEDULED CROSSREF_DEPOSIT row should be created when the attempt is no longer PENDING —
    // otherwise it gets promoted later and runs as a wasted no-op, and the "rescheduled" message
    // would be false.
    expect(mocks.insertJobRow).not.toHaveBeenCalled();
    expect(out).toMatchObject({
      status: 'COMPLETED',
      message: expect.stringMatching(/not rescheduled/),
    });
  });
});
