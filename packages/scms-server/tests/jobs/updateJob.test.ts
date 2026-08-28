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

const EXT_JOB = 'ACME_WORKER';
const OTHER_JOB = 'WIDGET_TASK';

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
    mockFindUnique.mockResolvedValue({ status: JobStatus.FAILED, job_type: 'PUBLISH' });
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
    mockFindUnique.mockResolvedValue({ status: JobStatus.RUNNING, job_type: 'PUBLISH' });
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
    mockFindUnique.mockResolvedValue({
      status: JobStatus.RUNNING,
      job_type: KnownJobTypes.CONVERTER_TASK,
    });
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

describe('updateJob onJobPatch', () => {
  const onJobPatch = vi.fn(async () => undefined);

  beforeEach(() => {
    mockFindUnique.mockReset();
    mockDbUpdateJob.mockReset();
    mockOnJobTerminal.mockReset();
    mockRecordConverterTaskTerminalActivity.mockReset();
    mockFormatJobDTO.mockReset();
    onJobPatch.mockReset();
    onJobPatch.mockResolvedValue(undefined);
    mockOnJobTerminal.mockResolvedValue(undefined);
    mockRecordConverterTaskTerminalActivity.mockResolvedValue(undefined);
    mockFormatJobDTO.mockReturnValue({ id: 'job-1' });
  });

  test('invokes matching extension onJobPatch after db update', async () => {
    mockFindUnique.mockResolvedValue({ status: JobStatus.RUNNING, job_type: EXT_JOB });
    const dbo = {
      id: 'job-1',
      job_type: EXT_JOB,
      status: JobStatus.RUNNING,
      payload: { work_id: 'w1' },
      results: { phase: 'readyForReview' },
      messages: [],
    };
    mockDbUpdateJob.mockResolvedValue(dbo);
    const update = {
      status: JobStatus.RUNNING,
      results: { phase: 'readyForReview' },
    };

    await updateJob({} as never, 'job-1', update, [
      {
        jobType: EXT_JOB,
        handler: vi.fn() as never,
        onJobPatch,
      },
      {
        jobType: OTHER_JOB,
        handler: vi.fn() as never,
        onJobPatch: vi.fn(),
      },
    ]);

    expect(onJobPatch).toHaveBeenCalledOnce();
    expect(onJobPatch).toHaveBeenCalledWith({
      ctx: expect.anything(),
      job: {
        id: 'job-1',
        job_type: EXT_JOB,
        status: JobStatus.RUNNING,
        payload: { work_id: 'w1' },
        results: { phase: 'readyForReview' },
        messages: [],
      },
      priorStatus: JobStatus.RUNNING,
      update,
    });
  });

  test('skips onJobPatch when job type has no registration', async () => {
    mockFindUnique.mockResolvedValue({ status: JobStatus.RUNNING, job_type: EXT_JOB });
    mockDbUpdateJob.mockResolvedValue({
      id: 'job-1',
      job_type: EXT_JOB,
      status: JobStatus.RUNNING,
      payload: {},
      results: null,
      messages: [],
    });

    await updateJob({} as never, 'job-1', { status: JobStatus.RUNNING }, [
      { jobType: OTHER_JOB, handler: vi.fn() as never, onJobPatch },
    ]);

    expect(onJobPatch).not.toHaveBeenCalled();
  });

  test('rethrows when onJobPatch fails', async () => {
    mockFindUnique.mockResolvedValue({ status: JobStatus.RUNNING, job_type: EXT_JOB });
    mockDbUpdateJob.mockResolvedValue({
      id: 'job-1',
      job_type: EXT_JOB,
      status: JobStatus.RUNNING,
      payload: {},
      results: null,
      messages: [],
    });
    onJobPatch.mockRejectedValue(new Error('hook blew up'));

    await expect(
      updateJob({} as never, 'job-1', { status: JobStatus.RUNNING }, [
        { jobType: EXT_JOB, handler: vi.fn() as never, onJobPatch },
      ]),
    ).rejects.toThrow('hook blew up');
  });
});
