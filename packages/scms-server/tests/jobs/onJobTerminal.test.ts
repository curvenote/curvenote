/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { JobStatus } from '@curvenote/scms-db';
import { KnownJobTypes } from '@curvenote/scms-core';

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockEnqueueAndDispatchJob = vi.fn();
const mockPromoteAndDispatchJob = vi.fn();

vi.mock('../../src/backend/prisma.server.js', () => ({
  getPrismaClient: vi.fn(async () => ({
    job: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      update: vi.fn(),
    },
  })),
}));

vi.mock('../../src/backend/jobs/enqueue/enqueueAndDispatchJob.server.js', () => ({
  enqueueAndDispatchJob: (...args: unknown[]) => mockEnqueueAndDispatchJob(...args),
}));

vi.mock('../../src/backend/jobs/enqueue/promoteAndDispatchJob.server.js', () => ({
  promoteAndDispatchJob: (...args: unknown[]) => mockPromoteAndDispatchJob(...args),
}));

import { onJobTerminal } from '../../src/backend/jobs/run/onJobTerminal.server.js';

describe('onJobTerminal', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockFindMany.mockReset();
    mockEnqueueAndDispatchJob.mockReset();
    mockPromoteAndDispatchJob.mockReset();
    mockFindMany.mockResolvedValue([]);
    mockEnqueueAndDispatchJob.mockResolvedValue({ job_id: 'cleanup-1', status: 'DISPATCHED' });
  });

  test('enqueues JOB_FAILED_DEFAULT when a domain job fails with no failure dependents', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'parent-1',
      job_type: KnownJobTypes.PUBLISH,
      invoked_by_id: 'user-1',
      messages: ['publish failed'],
    });

    await onJobTerminal('parent-1', JobStatus.FAILED);

    expect(mockEnqueueAndDispatchJob).toHaveBeenCalledOnce();
    expect(mockEnqueueAndDispatchJob.mock.calls[0][0]).toMatchObject({
      job_type: KnownJobTypes.JOB_FAILED_DEFAULT,
      payload: {
        failed_job_id: 'parent-1',
        failed_job_type: KnownJobTypes.PUBLISH,
        source: 'on_failure_fallback',
      },
    });
  });

  test('does not enqueue JOB_FAILED_DEFAULT when the failed parent is already a cleanup job', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'cleanup-parent',
      job_type: KnownJobTypes.JOB_FAILED_DEFAULT,
      invoked_by_id: 'user-1',
      messages: ['cleanup failed'],
    });

    await onJobTerminal('cleanup-parent', JobStatus.FAILED);

    expect(mockEnqueueAndDispatchJob).not.toHaveBeenCalled();
  });

  test('promotes FAILURE dependents when parent is CANCELLED', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'parent-cancelled',
      job_type: KnownJobTypes.CONVERTER_TASK,
      invoked_by_id: 'user-1',
      messages: [],
    });
    mockFindMany.mockResolvedValue([
      { id: 'failure-dep', trigger_on: 'FAILURE' },
      { id: 'success-dep', trigger_on: 'SUCCESS' },
    ]);

    await onJobTerminal('parent-cancelled', JobStatus.CANCELLED);

    expect(mockPromoteAndDispatchJob).toHaveBeenCalledOnce();
    expect(mockPromoteAndDispatchJob).toHaveBeenCalledWith('failure-dep');
    expect(mockEnqueueAndDispatchJob).not.toHaveBeenCalled();
  });
});
