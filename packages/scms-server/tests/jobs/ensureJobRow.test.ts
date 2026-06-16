/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { JobStatus } from '@curvenote/scms-db';

const mockFindUnique = vi.fn();
const mockCreate = vi.fn();

vi.mock('../../src/backend/prisma.server.js', () => ({
  getPrismaClient: vi.fn(async () => ({
    job: {
      findUnique: mockFindUnique,
      create: mockCreate,
    },
  })),
}));

import { ensureJobRow } from '../../src/backend/jobs/enqueue/ensureJobRow.server.js';

describe('ensureJobRow', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockCreate.mockReset();
  });

  test('creates QUEUED row when absent', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 'job-1', status: JobStatus.QUEUED });

    await ensureJobRow(
      {
        job_id: 'job-1',
        job_type: 'LOOPBACK',
        payload: { test: true },
      },
      JobStatus.QUEUED,
    );

    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate.mock.calls[0][0].data.status).toBe(JobStatus.QUEUED);
  });

  test('skips insert when row already exists', async () => {
    mockFindUnique.mockResolvedValue({ id: 'job-1', status: JobStatus.QUEUED });

    await ensureJobRow(
      {
        job_id: 'job-1',
        job_type: 'LOOPBACK',
        payload: {},
      },
      JobStatus.QUEUED,
    );

    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('creates BLOCKED row with dependency fields', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 'dep-1', status: JobStatus.BLOCKED });

    await ensureJobRow(
      {
        job_id: 'dep-1',
        job_type: 'CHECK',
        payload: {},
        depends_on_job_id: 'parent-1',
        trigger_on: 'success',
      },
      JobStatus.BLOCKED,
    );

    expect(mockCreate.mock.calls[0][0].data).toMatchObject({
      status: JobStatus.BLOCKED,
      depends_on_job_id: 'parent-1',
      trigger_on: 'SUCCESS',
    });
  });
});
