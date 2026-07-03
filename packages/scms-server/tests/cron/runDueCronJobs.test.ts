/* eslint-disable import/no-extraneous-dependencies */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CronJobTargetAuth, CronJobTargetType } from '@curvenote/scms-db';

const TEXT_INTEGRITY_RETRY_SWEEP_SCOPE = 'POST:/v1/hooks/text-integrity/retry-sweep';

function sqlText(arg: unknown): string {
  const candidate = arg as { sql?: string; strings?: string[] };
  if (typeof candidate?.sql === 'string') return candidate.sql;
  if (Array.isArray(candidate?.strings)) return candidate.strings.join(' ');
  return String(arg);
}

const mockTxSelectQueryRaw = vi.fn();
const mockTxExecuteRaw = vi.fn();
const mockTxCronJobUpdate = vi.fn();
const mockClaimQueryRaw = vi.fn();
const mockFindUnique = vi.fn();
const mockCronJobUpdate = vi.fn();
const mockEnqueueAndDispatchJob = vi.fn();
const mockFetch = vi.fn();

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

vi.stubGlobal('fetch', (...args: unknown[]) => mockFetch(...args));

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

  it('sets running_since via a single bulk UPDATE when claiming due jobs at tick time', async () => {
    const due = jobRow();
    mockTxSelectQueryRaw
      .mockResolvedValueOnce([due]) // SELECT ... FOR UPDATE SKIP LOCKED
      .mockResolvedValueOnce([{ ...due, running_since: '2026-07-03T12:00:00.000Z' }]); // bulk UPDATE ... RETURNING

    const result = await runDueCronJobs(10);

    expect(result.claimed).toBe(1);
    expect(mockTxSelectQueryRaw).toHaveBeenCalledTimes(2);
    expect(mockTxCronJobUpdate).not.toHaveBeenCalled();
    const bulkUpdateSql = sqlText(mockTxSelectQueryRaw.mock.calls[1]![0]);
    expect(bulkUpdateSql).toContain('UPDATE "CronJob"');
    expect(bulkUpdateSql).toContain('FROM (VALUES');
    // recordCronRun clears the lease again after execution.
    expect(mockCronJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ running_since: null }) }),
    );
  });

  it('does not issue a bulk UPDATE when nothing is due', async () => {
    mockTxSelectQueryRaw.mockResolvedValueOnce([]);

    const result = await runDueCronJobs(10);

    expect(result.claimed).toBe(0);
    expect(mockTxSelectQueryRaw).toHaveBeenCalledTimes(1);
  });
});

describe('runDueCronJobs execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCronJobUpdate.mockResolvedValue({});
  });

  it('runs independent due jobs concurrently and aggregates succeeded/failed correctly', async () => {
    const jobA = jobRow({ id: 'cron-a', name: 'job-a' });
    const jobB = jobRow({ id: 'cron-b', name: 'job-b' });
    mockTxSelectQueryRaw
      .mockResolvedValueOnce([jobA, jobB])
      .mockResolvedValueOnce([jobA, jobB]);
    mockEnqueueAndDispatchJob
      .mockResolvedValueOnce({ job_id: 'dispatched-a', status: 'DISPATCHED' })
      .mockRejectedValueOnce(new Error('dispatch failed for job-b'));

    const result = await runDueCronJobs(10);

    expect(result).toEqual({ claimed: 2, succeeded: 1, failed: 1 });
    expect(mockEnqueueAndDispatchJob).toHaveBeenCalledTimes(2);
    // Both jobs get their run recorded regardless of which one failed.
    expect(mockCronJobUpdate).toHaveBeenCalledTimes(2);
  });

  it('executes HTTP crons with scope-resolved target_url', async () => {
    const httpJob = jobRow({
      id: 'cron-http',
      name: 'retry-sweep',
      target_type: CronJobTargetType.HTTP,
      target_url: null,
      target_auth: CronJobTargetAuth.HANDSHAKE,
      target_scope: TEXT_INTEGRITY_RETRY_SWEEP_SCOPE,
      job_type: null,
      job_payload: null,
    });
    mockTxSelectQueryRaw.mockResolvedValueOnce([httpJob]).mockResolvedValueOnce([httpJob]);
    mockFetch.mockResolvedValue({ status: 200, text: async () => '' });

    const result = await runDueCronJobs(10);

    expect(result).toEqual({ claimed: 1, succeeded: 1, failed: 0 });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3031/v1/hooks/text-integrity/retry-sweep',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bearer /),
        }),
      }),
    );
  });

  it('records failure when scope-resolved HTTP cron has no target_scope', async () => {
    const httpJob = jobRow({
      id: 'cron-http',
      name: 'missing-scope',
      target_type: CronJobTargetType.HTTP,
      target_url: null,
      target_auth: CronJobTargetAuth.NONE,
      target_scope: null,
      job_type: null,
      job_payload: null,
    });
    mockTxSelectQueryRaw.mockResolvedValueOnce([httpJob]).mockResolvedValueOnce([httpJob]);

    const result = await runDueCronJobs(10);

    expect(result).toEqual({ claimed: 1, succeeded: 0, failed: 1 });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockCronJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          last_status: 'FAILED',
          last_error: 'HTTP cron missing target_url',
        }),
      }),
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
