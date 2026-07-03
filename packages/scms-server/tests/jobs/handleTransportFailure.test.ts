/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { JobStatus } from '@curvenote/scms-db';

const mockFindUnique = vi.fn();
const mockTerminalizeTransportFailure = vi.fn();
const mockEnqueueJobFailedDefault = vi.fn();
const mockOnJobTerminal = vi.fn();

vi.mock('../../src/backend/prisma.server.js', () => ({
  getPrismaClient: vi.fn(async () => ({
    job: { findUnique: mockFindUnique },
  })),
}));

vi.mock('../../src/backend/jobs/run/terminalizeTransportFailure.server.js', () => ({
  terminalizeTransportFailure: (...args: unknown[]) => mockTerminalizeTransportFailure(...args),
}));

vi.mock('../../src/backend/jobs/enqueue/enqueueJobFailedDefault.server.js', () => ({
  enqueueJobFailedDefault: (...args: unknown[]) => mockEnqueueJobFailedDefault(...args),
}));

vi.mock('../../src/backend/jobs/run/onJobTerminal.server.js', () => ({
  onJobTerminal: (...args: unknown[]) => mockOnJobTerminal(...args),
}));

import { handleTransportFailure } from '../../src/backend/jobs/run/handleTransportFailure.server.js';

describe('handleTransportFailure', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockTerminalizeTransportFailure.mockReset();
    mockEnqueueJobFailedDefault.mockReset();
    mockOnJobTerminal.mockReset();
    mockTerminalizeTransportFailure.mockResolvedValue(undefined);
    mockEnqueueJobFailedDefault.mockResolvedValue(undefined);
    mockOnJobTerminal.mockResolvedValue(undefined);
  });

  test('calls onJobTerminal so BLOCKED dependents get resolved after dead-letter', async () => {
    mockFindUnique.mockResolvedValue({ id: 'parent-1', status: JobStatus.FAILED });

    await handleTransportFailure('parent-1', {
      reason: 'transport_exhausted',
      source: 'dead_letter',
    });

    expect(mockTerminalizeTransportFailure).toHaveBeenCalledOnce();
    expect(mockEnqueueJobFailedDefault).toHaveBeenCalledOnce();
    expect(mockOnJobTerminal).toHaveBeenCalledWith('parent-1', JobStatus.FAILED, {
      skipFailedDefault: true,
    });
  });

  test('skips onJobTerminal when the job row no longer exists', async () => {
    mockFindUnique.mockResolvedValue(null);

    await handleTransportFailure('missing-job', {
      reason: 'invalid_handshake',
      source: 'dead_letter',
    });

    expect(mockOnJobTerminal).not.toHaveBeenCalled();
  });

  test('passes skipFailedDefault so a duplicate cleanup job is not enqueued', async () => {
    mockFindUnique.mockResolvedValue({ id: 'parent-2', status: JobStatus.COMPLETED });

    await handleTransportFailure('parent-2', {
      reason: 'unknown_job_type',
      source: 'dead_letter',
    });

    expect(mockOnJobTerminal).toHaveBeenCalledWith('parent-2', JobStatus.COMPLETED, {
      skipFailedDefault: true,
    });
  });
});
