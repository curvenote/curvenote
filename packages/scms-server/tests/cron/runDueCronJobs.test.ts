/* eslint-disable import/no-extraneous-dependencies */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CronJobTargetType } from '@curvenote/scms-db';

const mockTxSelectQueryRaw = vi.fn();
const mockTxExecuteRaw = vi.fn();
const mockTxCronJobUpdate = vi.fn();
const mockClaimQueryRaw = vi.fn();
const mockFindUnique = vi.fn();
const mockCronJobUpdate = vi.fn();
const mockEnqueueAndDispatchJob = vi.fn();

const tx = {
  $executeRaw: mockTxExecuteRaw,
  $queryRaw: mockTxSelectQueryRaw,
  cronJob: { update: mockTxCronJobUpdate },
};

const mockPrisma = {
  $transaction: vi.fn(async (cb: (client: typeof tx) => unknown) => cb(tx)),
  $queryRaw: mockClaimQueryRaw,
  cronJob: { findUnique: mockFindUnique, update: mockCronJobUpdate },
};

vi.mock('../../src/app-config.server.js', () => ({
  getConfig: vi.fn(async () => ({
    api: {
      url: 'http://localhost:3031/v1',
      handshakeIssuer: 'issuer',
      handshakeSigningSecret: 'secret',
      submissionsServiceAccount: { id: 'svc-account' },
    },
  })),
}));

vi.mock('../../src/backend/prisma.server.js', () => ({
  getPrismaClient: vi.fn(async () => mockPrisma),
}));

vi.mock('../../src/backend/jobs/enqueue/enqueueAndDispatchJob.server.js', () => ({
  enqueueAndDispatchJob: (...args: unknown[]) => mockEnqueueAndDispatchJob(...args),
}));

const { runDueCronJobs, runCronJobNow } = await import('../../src/backend/cron/runDueCronJobs.server.js');

function jobRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cron-1',
    name: 'sweep',
    schedule: '* * * * *',
    timezone: 'UTC',
    enabled: true,
    target_type: CronJobTargetType.JOB,
    target_url: null,
    http_method: 'POST',
    target_auth: 'NONE',
    target_scope: null,
    headers: null,
    payload: null,
    job_type: 'CHECK',
    job_payload: {},
    last_run_at: null,
    next_run_at: '2026-07-03T12:00:00.000Z',
    last_status: null,
    last_error: null,
    last_run_ms: null,
    running_since: null,
    created_by: null,
    date_created: '2026-07-01T00:00:00.000Z',
    date_modified: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('runDueCronJobs claim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnqueueAndDispatchJob.mockResolvedValue({ job_id: 'job-1', status: 'DISPATCHED' });
    mockCronJobUpdate.mockResolvedValue({});
  });

  it('sets running_since when claiming a due job at tick time', async () => {
    const due = jobRow();
    mockTxSelectQueryRaw.mockResolvedValue([due]);
    mockTxCronJobUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...due,
      ...data,
    }));

    const result = await runDueCronJobs(10);

    expect(result.claimed).toBe(1);
    expect(mockTxCronJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cron-1' },
        data: expect.objectContaining({ running_since: expect.any(String) }),
      }),
    );
    // recordCronRun clears the lease again after execution.
    expect(mockCronJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ running_since: null }) }),
    );
  });
});

describe('runCronJobNow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnqueueAndDispatchJob.mockResolvedValue({ job_id: 'job-1', status: 'DISPATCHED' });
    mockCronJobUpdate.mockResolvedValue({});
  });

  it('claims and executes when no lease is held', async () => {
    mockClaimQueryRaw.mockResolvedValue([jobRow({ running_since: null })]);

    await runCronJobNow('cron-1');

    expect(mockEnqueueAndDispatchJob).toHaveBeenCalledOnce();
    expect(mockCronJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ running_since: null }) }),
    );
  });

  it('rejects with "already running" when a live lease is held and the job exists', async () => {
    mockClaimQueryRaw.mockResolvedValue([]);
    mockFindUnique.mockResolvedValue(jobRow({ running_since: new Date().toISOString() }));

    await expect(runCronJobNow('cron-1')).rejects.toThrow(/already running/);
    expect(mockEnqueueAndDispatchJob).not.toHaveBeenCalled();
  });

  it('throws "not found" when the job does not exist at all', async () => {
    mockClaimQueryRaw.mockResolvedValue([]);
    mockFindUnique.mockResolvedValue(null);

    await expect(runCronJobNow('missing')).rejects.toThrow(/not found/);
    expect(mockEnqueueAndDispatchJob).not.toHaveBeenCalled();
  });
});
