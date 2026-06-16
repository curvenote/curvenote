/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { JobStatus } from '@curvenote/scms-db';
import { KnownJobTypes } from '@curvenote/scms-core';

const mockFindUnique = vi.fn();
const mockDbUpdateJob = vi.fn();
const mockOnJobTerminal = vi.fn();
const mockRecordConverterTaskTerminalActivity = vi.fn();
const mockFormatJobDTO = vi.fn();

vi.mock('../../src/backend/prisma.server.js', () => ({
  getPrismaClient: vi.fn(async () => ({
    job: {
      findUnique: mockFindUnique,
    },
  })),
}));

vi.mock('../../src/backend/jobs/handlers/db.server.js', () => ({
  dbUpdateJob: (...args: unknown[]) => mockDbUpdateJob(...args),
}));

vi.mock('../../src/backend/jobs/run/onJobTerminal.server.js', () => ({
  onJobTerminal: (...args: unknown[]) => mockOnJobTerminal(...args),
}));

vi.mock('../../src/backend/loaders/jobs/recordConverterTaskTerminalActivity.server.js', () => ({
  recordConverterTaskTerminalActivity: (...args: unknown[]) =>
    mockRecordConverterTaskTerminalActivity(...args),
}));

vi.mock('../../src/backend/loaders/jobs/get.server.js', () => ({
  formatJobDTO: (...args: unknown[]) => mockFormatJobDTO(...args),
}));

import updateJob from '../../src/backend/loaders/jobs/update.server.js';

describe('updateJob terminal handling', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockDbUpdateJob.mockReset();
    mockOnJobTerminal.mockReset();
    mockRecordConverterTaskTerminalActivity.mockReset();
    mockFormatJobDTO.mockReset();
    mockOnJobTerminal.mockResolvedValue(undefined);
    mockRecordConverterTaskTerminalActivity.mockResolvedValue(undefined);
    mockFormatJobDTO.mockReturnValue({ id: 'job-1' });
  });

  test('runs onJobTerminal only on the first transition to a terminal status', async () => {
    mockFindUnique.mockResolvedValue({ status: JobStatus.FAILED });
    mockDbUpdateJob.mockResolvedValue({
      id: 'job-1',
      status: JobStatus.FAILED,
      job_type: 'PUBLISH',
    });

    await updateJob({} as never, 'job-1', { status: JobStatus.FAILED });

    expect(mockOnJobTerminal).not.toHaveBeenCalled();
    expect(mockRecordConverterTaskTerminalActivity).not.toHaveBeenCalled();
  });

  test('invokes onJobTerminal when status newly becomes terminal', async () => {
    mockFindUnique.mockResolvedValue({ status: JobStatus.RUNNING });
    const dbo = {
      id: 'job-1',
      status: JobStatus.FAILED,
      job_type: 'PUBLISH',
    };
    mockDbUpdateJob.mockResolvedValue(dbo);

    await updateJob({} as never, 'job-1', { status: JobStatus.FAILED });

    expect(mockOnJobTerminal).toHaveBeenCalledOnce();
    expect(mockOnJobTerminal).toHaveBeenCalledWith('job-1', JobStatus.FAILED);
    expect(mockRecordConverterTaskTerminalActivity).toHaveBeenCalledOnce();
  });

  test('invokes onJobTerminal when status newly becomes CANCELLED', async () => {
    mockFindUnique.mockResolvedValue({ status: JobStatus.RUNNING });
    const dbo = {
      id: 'job-1',
      status: JobStatus.CANCELLED,
      job_type: KnownJobTypes.CONVERTER_TASK,
    };
    mockDbUpdateJob.mockResolvedValue(dbo);

    await updateJob({} as never, 'job-1', { status: JobStatus.CANCELLED });

    expect(mockOnJobTerminal).toHaveBeenCalledOnce();
    expect(mockOnJobTerminal).toHaveBeenCalledWith('job-1', JobStatus.CANCELLED);
    expect(mockRecordConverterTaskTerminalActivity).toHaveBeenCalledOnce();
  });
});
