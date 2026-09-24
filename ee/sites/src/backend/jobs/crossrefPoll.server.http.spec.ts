// Exercises crossrefPollHandler through the real fetchDepositResult() and parser against the
// recorded Crossref answers. Kept out of crossrefPoll.server.spec.ts, which mocks the fetch.
import { readFileSync } from 'node:fs';
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeFetch } from '../doi/testing.js';

const mocks = vi.hoisted(() => ({
  writePrivateXml: vi.fn(),
  applyDepositResult: vi.fn(),
  failDeposit: vi.fn(),
  insertJobRow: vi.fn(),
  dbUpdateJob: vi.fn(async (id: string, data: any) => ({ id, ...data })),
  prisma: {} as any,
}));
vi.mock('../crossref/client.server.js', async (orig) => ({
  ...(await orig<any>()),
  crossrefCredentialsFromConfig: () => ({
    host: 'https://test.crossref.org',
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

import { crossrefPollHandler } from './crossrefPoll.server.js';

const fixture = (name: string) =>
  readFileSync(new URL(`../crossref/fixtures/${name}`, import.meta.url), 'utf8');

const job = {
  id: 'job-p',
  job_type: 'CROSSREF_POLL',
  payload: { depositId: 'dep-1', siteId: 'site-a', attempt: 1 },
} as any;
const ctx = { $config: { api: { submissionsServiceAccount: { id: 'sa-1' } } } } as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma = {
    doiDeposit: {
      findUnique: vi.fn().mockResolvedValue({
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
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
    },
    siteDoiConfig: { findUnique: vi.fn().mockResolvedValue({ role: null, status: 'ACTIVE' }) },
  };
  mocks.prisma.$transaction = vi.fn(async (fn: any) => fn(mocks.prisma));
  mocks.insertJobRow.mockResolvedValue({ jobId: 'job-next' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('crossrefPollHandler (real fetchDepositResult() over a stubbed fetch)', () => {
  it('applies the recorded success result', async () => {
    vi.stubGlobal(
      'fetch',
      fakeFetch({ status: 200, body: fixture('submissionDownload.200-completed-success.xml') }),
    );
    await crossrefPollHandler(ctx, job);
    expect(mocks.applyDepositResult).toHaveBeenCalledWith(
      mocks.prisma,
      expect.objectContaining({ result: expect.objectContaining({ outcome: 'success' }) }),
    );
  });

  it('applies the recorded failure result', async () => {
    vi.stubGlobal(
      'fetch',
      fakeFetch({ status: 200, body: fixture('submissionDownload.200-completed-failure.xml') }),
    );
    await crossrefPollHandler(ctx, job);
    expect(mocks.applyDepositResult).toHaveBeenCalledWith(
      mocks.prisma,
      expect.objectContaining({ result: expect.objectContaining({ outcome: 'failure' }) }),
    );
  });

  it('reschedules on the recorded queued answer', async () => {
    vi.stubGlobal(
      'fetch',
      fakeFetch({ status: 200, body: fixture('submissionDownload.200-queued.xml') }),
    );
    await crossrefPollHandler(ctx, job);
    expect(mocks.insertJobRow).toHaveBeenCalled();
    expect(mocks.applyDepositResult).not.toHaveBeenCalled();
  });

  it('fails the attempt on the recorded 401', async () => {
    vi.stubGlobal(
      'fetch',
      fakeFetch({ status: 401, body: fixture('submissionDownload.401-wrong-credentials.txt') }),
    );
    await crossrefPollHandler(ctx, job);
    expect(mocks.failDeposit).toHaveBeenCalledWith(
      mocks.prisma,
      expect.objectContaining({ error: 'site_credentials_rejected' }),
    );
  });
});
