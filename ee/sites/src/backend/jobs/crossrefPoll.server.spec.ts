// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchDepositResult: vi.fn(),
  writePrivateXml: vi.fn(),
  applyDepositResult: vi.fn(),
  failDeposit: vi.fn(),
  insertJobRow: vi.fn(),
  dbUpdateJob: vi.fn(async (id: string, data: any) => ({ id, ...data })),
  prisma: {} as any,
}));
vi.mock('../crossref/depositResult.server.js', async (orig) => ({
  ...(await orig<any>()),
  fetchDepositResult: mocks.fetchDepositResult,
}));
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
  writePrivateXml: mocks.writePrivateXml,
  resultXmlKey: (fileName: string) => `crossref/results/${fileName}`,
}));
vi.mock('../registration/result.server.js', () => ({
  applyDepositResult: mocks.applyDepositResult,
  failDeposit: mocks.failDeposit,
}));
vi.mock('./schedule.server.js', () => ({ insertJobRow: mocks.insertJobRow }));
vi.mock('@curvenote/scms-server', () => ({
  getPrismaClient: async () => mocks.prisma,
  dbUpdateJob: mocks.dbUpdateJob,
}));

import { CrossrefError } from '../crossref/client.server.js';
import { crossrefPollHandler } from './crossrefPoll.server.js';

const row = (overrides = {}) => ({
  id: 'dep-1',
  status: 'QUEUED',
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
  },
  ...overrides,
});
const job = (attempt = 1) =>
  ({
    id: 'job-p',
    job_type: 'CROSSREF_POLL',
    payload: { depositId: 'dep-1', siteId: 'site-a', attempt },
  }) as any;
const ctx = { $config: { api: { submissionsServiceAccount: { id: 'sa-1' } } } } as any;
const completed = {
  state: 'completed',
  submissionId: '9',
  batchId: 'dep-1',
  outcome: 'success',
  records: [],
  xml: '<r/>',
};

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
  mocks.insertJobRow.mockResolvedValue({ jobId: 'job-next' });
  mocks.writePrivateXml.mockResolvedValue(undefined);
  mocks.applyDepositResult.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('crossrefPollHandler', () => {
  it('stores the raw result and applies a completed result', async () => {
    mocks.fetchDepositResult.mockResolvedValue(completed);
    const out = await crossrefPollHandler(ctx, job());
    expect(mocks.fetchDepositResult).toHaveBeenCalledWith(expect.anything(), {
      role: 'curv',
      fileName: 'dep-1.xml',
    });
    expect(mocks.writePrivateXml).toHaveBeenCalledWith(ctx, 'crossref/results/dep-1.xml', '<r/>');
    expect(mocks.applyDepositResult).toHaveBeenCalledWith(mocks.prisma, {
      deposit: expect.objectContaining({ id: 'dep-1' }),
      result: expect.objectContaining({ outcome: 'success' }),
      resultXmlPath: 'crossref/results/dep-1.xml',
      userId: 'sa-1',
    });
    expect(mocks.insertJobRow).not.toHaveBeenCalled();
    expect(out).toMatchObject({ status: 'COMPLETED' });
  });

  it('polls with the site role when the site has its own', async () => {
    mocks.prisma.siteDoiConfig.findUnique.mockResolvedValue({ role: 'elms', status: 'ACTIVE' });
    mocks.fetchDepositResult.mockResolvedValue(completed);
    await crossrefPollHandler(ctx, job());
    expect(mocks.fetchDepositResult).toHaveBeenCalledWith(expect.anything(), {
      role: 'elms',
      fileName: 'dep-1.xml',
    });
  });

  it('reschedules while queued, keeping Crossref submission id and the job id on the attempt', async () => {
    mocks.fetchDepositResult.mockResolvedValue({
      state: 'queued',
      submissionId: '1735620245',
      xml: '<q/>',
    });
    const out = await crossrefPollHandler(ctx, job(2));
    expect(mocks.prisma.doiDeposit.updateMany).toHaveBeenCalledWith({
      where: { id: 'dep-1', status: 'QUEUED' },
      data: { crossref_submission_id: '1735620245', date_modified: expect.any(String) },
    });
    expect(mocks.insertJobRow).toHaveBeenCalledWith(mocks.prisma, {
      jobType: 'CROSSREF_POLL',
      payload: { depositId: 'dep-1', siteId: 'site-a', attempt: 3 },
      scheduledAt: expect.any(String),
    });
    expect(mocks.prisma.doiDeposit.update).toHaveBeenCalledWith({
      where: { id: 'dep-1' },
      data: { job_id: 'job-next' },
    });
    expect(out).toMatchObject({ status: 'COMPLETED', message: expect.stringMatching(/queued/) });
  });

  it('schedules poll 11 two minutes out after ten one-minute polls', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-21T10:00:00.000Z'), toFake: ['Date'] });
    mocks.fetchDepositResult.mockResolvedValue({ state: 'queued', submissionId: '1', xml: '<q/>' });
    await crossrefPollHandler(ctx, job(10));
    expect(mocks.insertJobRow).toHaveBeenCalledWith(mocks.prisma, {
      jobType: 'CROSSREF_POLL',
      payload: { depositId: 'dep-1', siteId: 'site-a', attempt: 11 },
      scheduledAt: '2026-09-21T10:02:00.000Z',
    });
  });

  it('treats unknown_submission, a 5xx and a malformed body as no result yet, never clearing a known submission id', async () => {
    mocks.fetchDepositResult.mockResolvedValueOnce({ state: 'unknown_submission', xml: '<u/>' });
    await crossrefPollHandler(ctx, job());
    mocks.fetchDepositResult.mockRejectedValueOnce(
      new CrossrefError('Crossref result answered 503', 503),
    );
    await crossrefPollHandler(ctx, job());
    mocks.fetchDepositResult.mockRejectedValueOnce(
      new CrossrefError('Crossref result has an unexpected body', 200),
    );
    await crossrefPollHandler(ctx, job());
    expect(mocks.insertJobRow).toHaveBeenCalledTimes(3);
    for (const call of mocks.prisma.doiDeposit.updateMany.mock.calls) {
      expect(call[0].data.crossref_submission_id).toBeUndefined();
    }
    expect(mocks.failDeposit).not.toHaveBeenCalled();
  });

  it('retries a storage failure after a completed result instead of failing the registration', async () => {
    mocks.fetchDepositResult.mockResolvedValue(completed);
    mocks.writePrivateXml.mockRejectedValue(new Error('storage down'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = await crossrefPollHandler(ctx, job());
    expect(mocks.applyDepositResult).not.toHaveBeenCalled();
    expect(mocks.failDeposit).not.toHaveBeenCalled();
    expect(mocks.insertJobRow).toHaveBeenCalledWith(
      mocks.prisma,
      expect.objectContaining({ jobType: 'CROSSREF_POLL' }),
    );
    expect(out).toMatchObject({ status: 'COMPLETED' });
    error.mockRestore();
  });

  it('rethrows when the reschedule itself fails, so the job row is marked FAILED', async () => {
    mocks.fetchDepositResult.mockResolvedValue({ state: 'queued', submissionId: '1', xml: '<q/>' });
    const boom = new Error('db down');
    mocks.prisma.$transaction = vi.fn().mockRejectedValue(boom);
    await expect(crossrefPollHandler(ctx, job())).rejects.toBe(boom);
  });

  it('fails the attempt after the 72h horizon instead of polling again', async () => {
    mocks.prisma.doiDeposit.findUnique.mockResolvedValue(
      row({ date_created: new Date(Date.now() - 73 * 3600 * 1000).toISOString() }),
    );
    mocks.fetchDepositResult.mockResolvedValue({ state: 'queued', submissionId: '1', xml: '<q/>' });
    await crossrefPollHandler(ctx, job(10));
    expect(mocks.failDeposit).toHaveBeenCalledWith(mocks.prisma, {
      deposit: expect.objectContaining({ id: 'dep-1' }),
      error: 'no_result_after_72h',
      userId: 'sa-1',
    });
    expect(mocks.insertJobRow).not.toHaveBeenCalled();
  });

  it('still applies a completed result that arrives after the horizon', async () => {
    mocks.prisma.doiDeposit.findUnique.mockResolvedValue(
      row({ date_created: new Date(Date.now() - 73 * 3600 * 1000).toISOString() }),
    );
    mocks.fetchDepositResult.mockResolvedValue(completed);
    await crossrefPollHandler(ctx, job(10));
    expect(mocks.applyDepositResult).toHaveBeenCalled();
    expect(mocks.failDeposit).not.toHaveBeenCalled();
  });

  it('fails the attempt on 401 and leaves the site alone', async () => {
    mocks.fetchDepositResult.mockResolvedValue({ state: 'unauthorized' });
    await crossrefPollHandler(ctx, job());
    expect(mocks.failDeposit).toHaveBeenCalledWith(mocks.prisma, {
      deposit: expect.objectContaining({ id: 'dep-1' }),
      error: 'site_credentials_rejected',
      userId: 'sa-1',
    });
    expect(mocks.insertJobRow).not.toHaveBeenCalled();
  });

  it('fails the attempt without polling when the site is no longer ACTIVE', async () => {
    mocks.prisma.siteDoiConfig.findUnique.mockResolvedValue(null);
    await crossrefPollHandler(ctx, job());
    expect(mocks.fetchDepositResult).not.toHaveBeenCalled();
    expect(mocks.failDeposit).toHaveBeenCalledWith(
      mocks.prisma,
      expect.objectContaining({ error: 'site_not_active', userId: 'sa-1' }),
    );
  });

  it('completes as a no-op when the attempt is not QUEUED', async () => {
    mocks.prisma.doiDeposit.findUnique.mockResolvedValue(row({ status: 'SUCCEEDED' }));
    const out = await crossrefPollHandler(ctx, job());
    expect(mocks.fetchDepositResult).not.toHaveBeenCalled();
    expect(out).toMatchObject({ status: 'COMPLETED', message: expect.stringMatching(/no-op/) });
  });

  it('marks the job FAILED when the deposit row is missing', async () => {
    mocks.prisma.doiDeposit.findUnique.mockResolvedValue(null);
    expect(await crossrefPollHandler(ctx, job())).toMatchObject({ status: 'FAILED' });
  });

  it('does not insert a poll job when another delivery already advanced the attempt', async () => {
    mocks.prisma.doiDeposit.updateMany.mockResolvedValue({ count: 0 });
    mocks.fetchDepositResult.mockResolvedValue({ state: 'queued', submissionId: '1', xml: '<q/>' });
    const out = await crossrefPollHandler(ctx, job());
    expect(mocks.insertJobRow).not.toHaveBeenCalled();
    expect(out).toMatchObject({
      status: 'COMPLETED',
      message: expect.stringMatching(/not rescheduled/),
    });
  });
});
