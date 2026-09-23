// Exercises crossrefDepositHandler through the real `deposit()` HTTP call (client.server.ts's
// crossrefFetch against a stubbed global fetch), instead of mocking `deposit()` itself, using
// the shared HTTP fixtures. Kept out of crossrefDeposit.server.spec.ts because that file mocks
// '../crossref/deposit.server.js' at module level.
import { readFileSync } from 'node:fs';
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeFetch } from '../doi/testing.js';

const mocks = vi.hoisted(() => ({
  readPrivateXml: vi.fn(),
  failDeposit: vi.fn(),
  insertJobRow: vi.fn(),
  dispatchJob: vi.fn(),
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

import { crossrefDepositHandler } from './crossrefDeposit.server.js';

const fixture = (name: string) =>
  readFileSync(new URL(`../crossref/fixtures/${name}`, import.meta.url), 'utf8');

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
  mocks.insertJobRow.mockResolvedValue({ jobId: 'job-2', scheduled: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('crossrefDepositHandler (real deposit() over a stubbed fetch)', () => {
  it('reschedules the attempt on the 503 maintenance fixture without failing the deposit', async () => {
    vi.stubGlobal(
      'fetch',
      fakeFetch({ status: 503, body: fixture('deposit.503-maintenance.html') }),
    );
    const out = await crossrefDepositHandler(ctx, job);
    expect(mocks.insertJobRow).toHaveBeenCalledWith(
      mocks.prisma,
      expect.objectContaining({ jobType: 'CROSSREF_DEPOSIT' }),
    );
    expect(mocks.failDeposit).not.toHaveBeenCalled();
    expect(out).toMatchObject({ status: 'COMPLETED' });
  });
});
