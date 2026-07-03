// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobStatus } from '@curvenote/scms-db';

const mockDispatchJob = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();

const mockPrisma = {
  job: { findUnique: mockFindUnique, update: mockUpdate, updateMany: mockUpdateMany },
};

vi.mock('../../../app-config.server.js', () => ({
  getConfig: vi.fn(async () => ({
    api: { handshakeIssuer: 'issuer', handshakeSigningSecret: 'secret' },
  })),
}));

vi.mock('../../sign.handshake.server.js', () => ({
  createHandshakeToken: vi.fn(() => 'handshake-token'),
}));

vi.mock('../../prisma.server.js', () => ({
  getPrismaClient: vi.fn(async () => mockPrisma),
}));

vi.mock('./dispatchJob.server.js', () => ({
  dispatchJob: (...args: unknown[]) => mockDispatchJob(...args),
}));

const { promoteAndDispatchJob } = await import('./promoteAndDispatchJob.server.js');

describe('promoteAndDispatchJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({ id: 'dep-1', job_type: 'CHECK', status: JobStatus.BLOCKED });
    mockUpdate.mockResolvedValue({});
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockDispatchJob.mockResolvedValue({ messageId: '1' });
  });

  it('promotes BLOCKED to QUEUED and dispatches on success', async () => {
    await promoteAndDispatchJob('dep-1');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'dep-1' },
      data: { status: JobStatus.QUEUED },
    });
    expect(mockDispatchJob).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('reverts to BLOCKED when dispatch fails, without throwing', async () => {
    mockDispatchJob.mockRejectedValueOnce(new Error('pgmq unavailable'));

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
    expect(mockDispatchJob).not.toHaveBeenCalled();
  });
});
