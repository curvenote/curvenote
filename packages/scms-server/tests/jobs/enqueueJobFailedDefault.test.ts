/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { JobStatus } from '@curvenote/scms-db';
import { KnownJobTypes } from '@curvenote/scms-core';

const mockFindUnique = vi.fn();
const mockEnqueueAndDispatchJob = vi.fn();

vi.mock('../../src/backend/prisma.server.js', () => ({
  getPrismaClient: vi.fn(async () => ({
    job: { findUnique: mockFindUnique },
  })),
}));

vi.mock('../../src/backend/jobs/enqueue/enqueueAndDispatchJob.server.js', () => ({
  enqueueAndDispatchJob: (...args: unknown[]) => mockEnqueueAndDispatchJob(...args),
}));

const { enqueueJobFailedDefault } = await import(
  '../../src/backend/jobs/enqueue/enqueueJobFailedDefault.server.js'
);

describe('enqueueJobFailedDefault', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockEnqueueAndDispatchJob.mockReset();
    mockEnqueueAndDispatchJob.mockResolvedValue({ job_id: 'cleanup-1', status: 'DISPATCHED' });
  });

  test('enqueues cleanup for a dead-lettered job that never completed', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'job-1',
      job_type: KnownJobTypes.PUBLISH,
      status: JobStatus.QUEUED,
      invoked_by_id: 'user-1',
    });

    await enqueueJobFailedDefault('job-1', { reason: 'transport_exhausted', source: 'dead_letter' });

    expect(mockEnqueueAndDispatchJob).toHaveBeenCalledOnce();
    expect(mockEnqueueAndDispatchJob.mock.calls[0][0]).toMatchObject({
      job_type: KnownJobTypes.JOB_FAILED_DEFAULT,
      payload: { failed_job_id: 'job-1', failed_job_type: KnownJobTypes.PUBLISH },
    });
  });

  test('skips cleanup when the job already COMPLETED', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'job-1',
      job_type: KnownJobTypes.PUBLISH,
      status: JobStatus.COMPLETED,
      invoked_by_id: 'user-1',
    });

    await enqueueJobFailedDefault('job-1', { reason: 'transport_exhausted', source: 'dead_letter' });

    expect(mockEnqueueAndDispatchJob).not.toHaveBeenCalled();
  });

  test('skips cleanup when source is not dead_letter', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'job-1',
      job_type: KnownJobTypes.PUBLISH,
      status: JobStatus.QUEUED,
      invoked_by_id: 'user-1',
    });

    await enqueueJobFailedDefault('job-1', { reason: 'domain_failed', source: 'on_failure_fallback' });

    expect(mockEnqueueAndDispatchJob).not.toHaveBeenCalled();
  });

  test('skips cleanup for a job that is itself already a cleanup job', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'job-1',
      job_type: KnownJobTypes.JOB_FAILED_DEFAULT,
      status: JobStatus.QUEUED,
      invoked_by_id: 'user-1',
    });

    await enqueueJobFailedDefault('job-1', { reason: 'transport_exhausted', source: 'dead_letter' });

    expect(mockEnqueueAndDispatchJob).not.toHaveBeenCalled();
  });
});
