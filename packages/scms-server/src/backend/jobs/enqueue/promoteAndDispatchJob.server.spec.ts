// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobStatus } from '@curvenote/scms-db';

const mockDispatchJobWithHandshake = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();

const mockPrisma = {
  job: { findUnique: mockFindUnique, update: mockUpdate, updateMany: mockUpdateMany },
};

vi.mock('../../prisma.server.js', () => ({
  getPrismaClient: vi.fn(async () => mockPrisma),
}));

vi.mock('./dispatchJob.server.js', () => ({
  dispatchJobWithHandshake: (...args: unknown[]) => mockDispatchJobWithHandshake(...args),
}));

const { promoteAndDispatchJob } = await import('./promoteAndDispatchJob.server.js');

describe('promoteAndDispatchJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({ id: 'dep-1', job_type: 'CHECK', status: JobStatus.BLOCKED });
    mockUpdate.mockResolvedValue({});
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockDispatchJobWithHandshake.mockResolvedValue({ messageId: '1' });
  });

  it('promotes BLOCKED to QUEUED and dispatches on success', async () => {
    await promoteAndDispatchJob('dep-1');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'dep-1' },
      data: { status: JobStatus.QUEUED },
    });
    expect(mockDispatchJobWithHandshake).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('reverts to BLOCKED when dispatch fails, without throwing', async () => {
    mockDispatchJobWithHandshake.mockRejectedValueOnce(new Error('pgmq unavailable'));

    await expect(promoteAndDispatchJob('dep-1')).resolves.toBeUndefined();

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 'dep-1', status: JobStatus.QUEUED },
      data: { status: JobStatus.BLOCKED },
    });
  });

  it('skips jobs that are not BLOCKED', async () => {
    mockFindUnique.mockResolvedValue({ id: 'dep-1', job_type: 'CHECK', status: JobStatus.QUEUED });

    await promoteAndDispatchJob('dep-1');

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockDispatchJobWithHandshake).not.toHaveBeenCalled();
  });
});
