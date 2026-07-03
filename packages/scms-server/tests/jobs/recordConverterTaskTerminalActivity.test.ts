/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { JobStatus } from '@curvenote/scms-db';
import type { Job } from '@curvenote/scms-db';
import { KnownJobTypes } from '@curvenote/scms-core';

const mockLinkedJobFindFirst = vi.fn();
const mockWorkVersionFindUnique = vi.fn();
const mockCreateWorkActivity = vi.fn();

vi.mock('../../src/backend/prisma.server.js', () => ({
  getPrismaClient: vi.fn(async () => ({
    linkedJob: { findFirst: mockLinkedJobFindFirst },
    workVersion: { findUnique: mockWorkVersionFindUnique },
  })),
}));

vi.mock('../../src/backend/db.server.js', () => ({
  createWorkActivity: (...args: unknown[]) => mockCreateWorkActivity(...args),
}));

import { recordConverterTaskTerminalActivity } from '../../src/backend/loaders/jobs/recordConverterTaskTerminalActivity.server.js';

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    job_type: KnownJobTypes.CONVERTER_TASK,
    invoked_by_id: 'user-1',
    payload: {
      work_version_id: 'wv-1',
      target: 'pdf',
      conversion_type: 'docx-pandoc-myst-pdf',
    },
    results: null,
    messages: [],
    status: JobStatus.COMPLETED,
    date_created: '',
    date_modified: '',
    activity_type: null,
    depends_on_job_id: null,
    trigger_on: null,
    ...overrides,
  } as Job;
}

describe('recordConverterTaskTerminalActivity', () => {
  beforeEach(() => {
    mockLinkedJobFindFirst.mockReset();
    mockWorkVersionFindUnique.mockReset();
    mockCreateWorkActivity.mockReset();
    mockCreateWorkActivity.mockResolvedValue(undefined);
    mockWorkVersionFindUnique.mockResolvedValue({ work_id: 'work-1' });
  });

  test('no-ops for non-converter jobs', async () => {
    await recordConverterTaskTerminalActivity(
      makeJob({ job_type: KnownJobTypes.CHECK }),
      JobStatus.COMPLETED,
    );

    expect(mockCreateWorkActivity).not.toHaveBeenCalled();
    expect(mockWorkVersionFindUnique).not.toHaveBeenCalled();
  });

  test('no-ops when invoked_by_id is missing', async () => {
    await recordConverterTaskTerminalActivity(
      makeJob({ invoked_by_id: null }),
      JobStatus.COMPLETED,
    );

    expect(mockCreateWorkActivity).not.toHaveBeenCalled();
  });

  test('COMPLETED uses work_version_id from payload', async () => {
    await recordConverterTaskTerminalActivity(makeJob(), JobStatus.COMPLETED);

    expect(mockLinkedJobFindFirst).not.toHaveBeenCalled();
    expect(mockCreateWorkActivity).toHaveBeenCalledWith({
      workId: 'work-1',
      workVersionId: 'wv-1',
      activityById: 'user-1',
      activityType: 'CONVERTER_TASK_COMPLETED',
      data: {
        converter: { target: 'pdf', type: 'docx-pandoc-myst-pdf' },
        job_id: 'job-1',
      },
    });
  });

  test('resolves work_version_id from LinkedJob when absent in payload', async () => {
    mockLinkedJobFindFirst.mockResolvedValue({ work_version_id: 'wv-linked' });

    await recordConverterTaskTerminalActivity(
      makeJob({ payload: { target: 'pdf' } }),
      JobStatus.COMPLETED,
    );

    expect(mockLinkedJobFindFirst).toHaveBeenCalledWith({
      where: { job_id: 'job-1' },
      select: { work_version_id: true },
    });
    expect(mockCreateWorkActivity).toHaveBeenCalledWith(
      expect.objectContaining({ workVersionId: 'wv-linked' }),
    );
  });

  test('FAILED sets data.error from last message', async () => {
    await recordConverterTaskTerminalActivity(
      makeJob({ messages: ['step ok', 'Converter blew up'] }),
      JobStatus.FAILED,
    );

    expect(mockCreateWorkActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        activityType: 'CONVERTER_TASK_FAILED',
        data: expect.objectContaining({ error: 'Converter blew up' }),
      }),
    );
  });

  test('FAILED falls back to results.error then default message', async () => {
    await recordConverterTaskTerminalActivity(
      makeJob({ messages: [], results: { error: 'from results' } }),
      JobStatus.FAILED,
    );

    expect(mockCreateWorkActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ error: 'from results' }),
      }),
    );

    mockCreateWorkActivity.mockReset();
    await recordConverterTaskTerminalActivity(
      makeJob({ messages: [], results: null }),
      JobStatus.FAILED,
    );

    expect(mockCreateWorkActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ error: 'Conversion failed' }),
      }),
    );
  });

  test('CANCELLED uses cancellation default when no message', async () => {
    await recordConverterTaskTerminalActivity(makeJob({ messages: [] }), JobStatus.CANCELLED);

    expect(mockCreateWorkActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        activityType: 'CONVERTER_TASK_FAILED',
        data: expect.objectContaining({ error: 'Document conversion was cancelled.' }),
      }),
    );
  });

  test('skips create when work version is missing', async () => {
    mockWorkVersionFindUnique.mockResolvedValue(null);

    await recordConverterTaskTerminalActivity(makeJob(), JobStatus.COMPLETED);

    expect(mockCreateWorkActivity).not.toHaveBeenCalled();
  });

  test('swallows lookup errors without throwing', async () => {
    mockWorkVersionFindUnique.mockRejectedValue(new Error('db down'));

    await expect(
      recordConverterTaskTerminalActivity(makeJob(), JobStatus.COMPLETED),
    ).resolves.toBeUndefined();
    expect(mockCreateWorkActivity).not.toHaveBeenCalled();
  });

  test('swallows createWorkActivity errors without throwing', async () => {
    mockCreateWorkActivity.mockRejectedValue(new Error('insert failed'));

    await expect(
      recordConverterTaskTerminalActivity(makeJob(), JobStatus.COMPLETED),
    ).resolves.toBeUndefined();
  });
});
