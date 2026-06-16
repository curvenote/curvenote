/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { JobStatus } from '@curvenote/scms-db';
import { KnownJobTypes } from '@curvenote/scms-core';

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockJobUpdate = vi.fn();
const mockEnqueueAndDispatchJob = vi.fn();
const mockPromoteAndDispatchJob = vi.fn();

vi.mock('../../src/backend/prisma.server.js', () => ({
  getPrismaClient: vi.fn(async () => ({
    job: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      update: mockJobUpdate,
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
    mockJobUpdate.mockReset();
    mockEnqueueAndDispatchJob.mockReset();
    mockPromoteAndDispatchJob.mockReset();
    mockFindMany.mockResolvedValue([]);
    mockJobUpdate.mockResolvedValue({});
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
    mockFindMany.mockImplementation(async ({ where }: { where: { depends_on_job_id: string } }) => {
      if (where.depends_on_job_id === 'parent-cancelled') {
        return [
          { id: 'failure-dep', trigger_on: 'FAILURE' },
          { id: 'success-dep', trigger_on: 'SUCCESS' },
        ];
      }
      return [];
    });

    await onJobTerminal('parent-cancelled', JobStatus.CANCELLED);

    expect(mockPromoteAndDispatchJob).toHaveBeenCalledOnce();
    expect(mockPromoteAndDispatchJob).toHaveBeenCalledWith('failure-dep');
    expect(mockJobUpdate).toHaveBeenCalledWith({
      where: { id: 'success-dep' },
      data: { status: JobStatus.CANCELLED },
    });
    expect(mockEnqueueAndDispatchJob).not.toHaveBeenCalled();
  });

  test('cascades cancellation to grandchildren when a SUCCESS dependent is dropped', async () => {
    mockFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      job_type: KnownJobTypes.PUBLISH,
      invoked_by_id: 'user-1',
      messages: [],
    }));
    mockFindMany.mockImplementation(async ({ where }: { where: { depends_on_job_id: string } }) => {
      if (where.depends_on_job_id === 'parent-failed') {
        return [{ id: 'child-success', trigger_on: 'SUCCESS' }];
      }
      if (where.depends_on_job_id === 'child-success') {
        return [{ id: 'grandchild-success', trigger_on: 'SUCCESS' }];
      }
      return [];
    });

    await onJobTerminal('parent-failed', JobStatus.FAILED);

    expect(mockJobUpdate).toHaveBeenCalledTimes(2);
    expect(mockJobUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 'child-success' },
      data: { status: JobStatus.CANCELLED },
    });
    expect(mockJobUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 'grandchild-success' },
      data: { status: JobStatus.CANCELLED },
    });
    expect(mockPromoteAndDispatchJob).not.toHaveBeenCalled();
    expect(mockEnqueueAndDispatchJob).toHaveBeenCalledOnce();
  });

  test('tears down FAILURE grandchildren when a COMPLETED parent cancels a FAILURE dependent', async () => {
    mockFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      job_type: KnownJobTypes.PUBLISH,
      invoked_by_id: 'user-1',
      messages: [],
    }));
    mockFindMany.mockImplementation(async ({ where }: { where: { depends_on_job_id: string } }) => {
      if (where.depends_on_job_id === 'parent-completed') {
        return [{ id: 'failure-child', trigger_on: 'FAILURE' }];
      }
      if (where.depends_on_job_id === 'failure-child') {
        return [{ id: 'failure-grandchild', trigger_on: 'FAILURE' }];
      }
      return [];
    });

    await onJobTerminal('parent-completed', JobStatus.COMPLETED);

    expect(mockJobUpdate).toHaveBeenCalledTimes(2);
    expect(mockJobUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 'failure-child' },
      data: { status: JobStatus.CANCELLED },
    });
    expect(mockJobUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 'failure-grandchild' },
      data: { status: JobStatus.CANCELLED },
    });
    expect(mockPromoteAndDispatchJob).not.toHaveBeenCalled();
  });

  test('tears down FAILURE grandchildren when a dropped SUCCESS dependent is cancelled', async () => {
    mockFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      job_type: KnownJobTypes.PUBLISH,
      invoked_by_id: 'user-1',
      messages: [],
    }));
    mockFindMany.mockImplementation(async ({ where }: { where: { depends_on_job_id: string } }) => {
      if (where.depends_on_job_id === 'parent-failed') {
        return [{ id: 'child-success', trigger_on: 'SUCCESS' }];
      }
      if (where.depends_on_job_id === 'child-success') {
        return [{ id: 'failure-grandchild', trigger_on: 'FAILURE' }];
      }
      return [];
    });

    await onJobTerminal('parent-failed', JobStatus.FAILED);

    expect(mockJobUpdate).toHaveBeenCalledTimes(2);
    expect(mockJobUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 'child-success' },
      data: { status: JobStatus.CANCELLED },
    });
    expect(mockJobUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 'failure-grandchild' },
      data: { status: JobStatus.CANCELLED },
    });
    expect(mockPromoteAndDispatchJob).not.toHaveBeenCalled();
  });

  test('does not enqueue JOB_FAILED_DEFAULT when cascading cancellation from a dependent', async () => {
    mockFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      job_type: KnownJobTypes.CHECK,
      invoked_by_id: 'user-1',
      messages: [],
    }));
    mockFindMany.mockImplementation(async ({ where }: { where: { depends_on_job_id: string } }) => {
      if (where.depends_on_job_id === 'parent-failed') {
        return [{ id: 'child-success', trigger_on: 'SUCCESS' }];
      }
      return [];
    });

    await onJobTerminal('parent-failed', JobStatus.FAILED);

    expect(mockJobUpdate).toHaveBeenCalledOnce();
    expect(mockEnqueueAndDispatchJob).toHaveBeenCalledOnce();
    expect(mockEnqueueAndDispatchJob.mock.calls[0][0]).toMatchObject({
      payload: { failed_job_id: 'parent-failed' },
    });
  });
});
