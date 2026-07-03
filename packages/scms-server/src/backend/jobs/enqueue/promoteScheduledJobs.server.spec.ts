// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobStatus } from '@curvenote/scms-db';

const mockDispatchJobWithHandshake = vi.fn();
const mockUpdateMany = vi.fn();
const mockQueryRaw = vi.fn();

const tx = {
  $queryRaw: mockQueryRaw,
};

const mockPrisma = {
  $transaction: vi.fn(async (cb: (client: typeof tx) => unknown) => cb(tx)),
  job: { updateMany: mockUpdateMany },
};

vi.mock('../../prisma.server.js', () => ({
  getPrismaClient: vi.fn(async () => mockPrisma),
}));

vi.mock('./dispatchJob.server.js', () => ({
  dispatchJobWithHandshake: (...args: unknown[]) => mockDispatchJobWithHandshake(...args),
}));

const { promoteScheduledJobs } = await import('./promoteScheduledJobs.server.js');

describe('promoteScheduledJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRaw.mockResolvedValue([
      { id: 'job-1', job_type: 'LOOPBACK' },
      { id: 'job-2', job_type: 'LOOPBACK' },
    ]);
    mockDispatchJobWithHandshake.mockResolvedValue({ messageId: '1' });
    mockUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('dispatches all claimed jobs when enqueue succeeds', async () => {
    const result = await promoteScheduledJobs(2);

    expect(result).toEqual({ claimed: 2, dispatched: 2, dispatchFailed: 0 });
    expect(mockDispatchJobWithHandshake).toHaveBeenCalledTimes(2);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('reverts to SCHEDULED and continues when dispatch fails for one job', async () => {
    mockDispatchJobWithHandshake
      .mockRejectedValueOnce(new Error('pgmq unavailable'))
      .mockResolvedValueOnce({ messageId: '2' });

    const result = await promoteScheduledJobs(2);

    expect(result).toEqual({ claimed: 2, dispatched: 1, dispatchFailed: 1 });
    expect(mockDispatchJobWithHandshake).toHaveBeenCalledTimes(2);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 'job-1', status: JobStatus.QUEUED },
      data: expect.objectContaining({ status: JobStatus.SCHEDULED }),
    });
  });
});
