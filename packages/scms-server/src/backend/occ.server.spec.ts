// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { httpError } from '@curvenote/scms-core';
import {
  safeJsonUpdateGeneric,
  safeWorkVersionJsonUpdate,
  safeSubmissionVersionJsonUpdate,
  safeSubmissionKindJsonUpdate,
} from './occ.server.js';

// Mock dependencies
vi.mock('./prisma.server', () => ({
  getPrismaClient: vi.fn(),
}));

vi.mock('@curvenote/scms-core', async () => {
  const actual = await vi.importActual('@curvenote/scms-core');
  return {
    ...actual,
    httpError: vi.fn((status: number, message: string) => {
      const error = new Error(message) as any;
      error.status = status;
      throw error;
    }),
    delay: vi.fn().mockResolvedValue(undefined),
  };
});

describe('OCC Functions', () => {
  let mockPrisma: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create mock Prisma client
    mockPrisma = {
      workVersion: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      submissionVersion: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      submissionKind: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    const { getPrismaClient } = await import('./prisma.server.js');
    vi.mocked(getPrismaClient).mockResolvedValue(mockPrisma);
  });

  describe('safeJsonUpdateGeneric', () => {
    it('should successfully update WorkVersion metadata', async () => {
      const workVersionId = 'test-work-version-id';
      const mockMetadata = { version: 1, test: 'data' };
      const updatedMetadata = { version: 1, test: 'updated' };

      mockPrisma.workVersion.findUnique.mockResolvedValue({
        id: workVersionId,
        metadata: mockMetadata,
        occ: 1,
      });

      mockPrisma.workVersion.update.mockResolvedValue({
        id: workVersionId,
        metadata: updatedMetadata,
        occ: 2,
      });

      const modifyFn = vi.fn().mockReturnValue(updatedMetadata);

      const result = await safeJsonUpdateGeneric('workVersion', workVersionId, modifyFn);

      expect(mockPrisma.workVersion.findUnique).toHaveBeenCalledWith({
        where: { id: workVersionId },
      });
      expect(modifyFn).toHaveBeenCalledWith(mockMetadata);
      expect(mockPrisma.workVersion.update).toHaveBeenCalledWith({
        where: { id: workVersionId, occ: 1 },
        data: {
          metadata: updatedMetadata,
          occ: { increment: 1 },
          date_modified: expect.any(String),
        },
      });
      expect(result).toEqual({
        id: workVersionId,
        metadata: updatedMetadata,
        occ: 2,
      });
    });

    it('should successfully update SubmissionVersion metadata', async () => {
      const submissionVersionId = 'test-submission-version-id';
      const mockMetadata = { version: 1, test: 'data' };
      const updatedMetadata = { version: 1, test: 'updated' };

      mockPrisma.submissionVersion.findUnique.mockResolvedValue({
        id: submissionVersionId,
        metadata: mockMetadata,
        occ: 1,
      });

      mockPrisma.submissionVersion.update.mockResolvedValue({
        id: submissionVersionId,
        metadata: updatedMetadata,
        occ: 2,
      });

      const modifyFn = vi.fn().mockReturnValue(updatedMetadata);

      const result = await safeJsonUpdateGeneric(
        'submissionVersion',
        submissionVersionId,
        modifyFn,
      );

      expect(mockPrisma.submissionVersion.findUnique).toHaveBeenCalledWith({
        where: { id: submissionVersionId },
      });
      expect(modifyFn).toHaveBeenCalledWith(mockMetadata);
      expect(mockPrisma.submissionVersion.update).toHaveBeenCalledWith({
        where: { id: submissionVersionId, occ: 1 },
        data: {
          metadata: updatedMetadata,
          occ: { increment: 1 },
          date_modified: expect.any(String),
        },
      });
      expect(result).toEqual({
        id: submissionVersionId,
        metadata: updatedMetadata,
        occ: 2,
      });
    });

    it('should successfully update SubmissionKind content', async () => {
      const submissionKindId = 'test-submission-kind-id';
      const mockContent = { title: 'Test', description: 'Test description' };
      const updatedContent = { title: 'Updated', description: 'Updated description' };

      mockPrisma.submissionKind.findUnique.mockResolvedValue({
        id: submissionKindId,
        content: mockContent,
        occ: 1,
      });

      mockPrisma.submissionKind.update.mockResolvedValue({
        id: submissionKindId,
        content: updatedContent,
        occ: 2,
      });

      const modifyFn = vi.fn().mockReturnValue(updatedContent);

      const result = await safeJsonUpdateGeneric('submissionKind', submissionKindId, modifyFn);

      expect(mockPrisma.submissionKind.findUnique).toHaveBeenCalledWith({
        where: { id: submissionKindId },
      });
      expect(modifyFn).toHaveBeenCalledWith(mockContent);
      expect(mockPrisma.submissionKind.update).toHaveBeenCalledWith({
        where: { id: submissionKindId, occ: 1 },
        data: { content: updatedContent, occ: { increment: 1 }, date_modified: expect.any(String) },
      });
      expect(result).toEqual({
        id: submissionKindId,
        content: updatedContent,
        occ: 2,
      });
    });

    it('should throw 404 error when record not found', async () => {
      const workVersionId = 'non-existent-id';
      mockPrisma.workVersion.findUnique.mockResolvedValue(null);

      const modifyFn = vi.fn();

      await expect(safeJsonUpdateGeneric('workVersion', workVersionId, modifyFn)).rejects.toThrow(
        'WorkVersion not found',
      );

      expect(httpError).toHaveBeenCalledWith(404, 'WorkVersion not found');
    });

    it('should retry on OCC conflict and eventually succeed', async () => {
      const workVersionId = 'test-work-version-id';
      const mockMetadata = { version: 1, test: 'data' };
      const updatedMetadata = { version: 1, test: 'updated' };

      mockPrisma.workVersion.findUnique
        .mockResolvedValueOnce({
          id: workVersionId,
          metadata: mockMetadata,
          occ: 1,
        })
        .mockResolvedValueOnce({
          id: workVersionId,
          metadata: mockMetadata,
          occ: 2,
        });

      // First update fails due to OCC conflict
      mockPrisma.workVersion.update
        .mockRejectedValueOnce(new Error('OCC conflict'))
        .mockResolvedValueOnce({
          id: workVersionId,
          metadata: updatedMetadata,
          occ: 3,
        });

      const modifyFn = vi.fn().mockReturnValue(updatedMetadata);

      const result = await safeJsonUpdateGeneric('workVersion', workVersionId, modifyFn, 3);

      expect(mockPrisma.workVersion.findUnique).toHaveBeenCalledTimes(2);
      expect(mockPrisma.workVersion.update).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        id: workVersionId,
        metadata: updatedMetadata,
        occ: 3,
      });
    });

    it('should throw 409 error after max retries', async () => {
      const workVersionId = 'test-work-version-id';
      const mockMetadata = { version: 1, test: 'data' };

      mockPrisma.workVersion.findUnique.mockResolvedValue({
        id: workVersionId,
        metadata: mockMetadata,
        occ: 1,
      });

      mockPrisma.workVersion.update.mockRejectedValue(new Error('OCC conflict'));

      const modifyFn = vi.fn().mockReturnValue({ version: 1, test: 'updated' });

      await expect(
        safeJsonUpdateGeneric('workVersion', workVersionId, modifyFn, 2),
      ).rejects.toThrow('OCC: Could not update WorkVersion after 2 retries');

      expect(httpError).toHaveBeenCalledWith(
        409,
        'OCC: Could not update WorkVersion after 2 retries',
      );
      expect(mockPrisma.workVersion.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('Model-specific wrapper functions', () => {
    it('should call safeJsonUpdateGeneric with correct model type for WorkVersion', async () => {
      const workVersionId = 'test-work-version-id';
      const mockMetadata = { version: 1, test: 'data' };
      const updatedMetadata = { version: 1, test: 'updated' };

      mockPrisma.workVersion.findUnique.mockResolvedValue({
        id: workVersionId,
        metadata: mockMetadata,
        occ: 1,
      });

      mockPrisma.workVersion.update.mockResolvedValue({
        id: workVersionId,
        metadata: updatedMetadata,
        occ: 2,
      });

      const modifyFn = vi.fn().mockReturnValue(updatedMetadata);

      const result = await safeWorkVersionJsonUpdate(workVersionId, modifyFn);

      expect(result).toEqual({
        id: workVersionId,
        metadata: updatedMetadata,
        occ: 2,
      });
    });

    it('should call safeJsonUpdateGeneric with correct model type for SubmissionVersion', async () => {
      const submissionVersionId = 'test-submission-version-id';
      const mockMetadata = { version: 1, test: 'data' };
      const updatedMetadata = { version: 1, test: 'updated' };

      mockPrisma.submissionVersion.findUnique.mockResolvedValue({
        id: submissionVersionId,
        metadata: mockMetadata,
        occ: 1,
      });

      mockPrisma.submissionVersion.update.mockResolvedValue({
        id: submissionVersionId,
        metadata: updatedMetadata,
        occ: 2,
      });

      const modifyFn = vi.fn().mockReturnValue(updatedMetadata);

      const result = await safeSubmissionVersionJsonUpdate(submissionVersionId, modifyFn);

      expect(result).toEqual({
        id: submissionVersionId,
        metadata: updatedMetadata,
        occ: 2,
      });
    });

    it('should call safeJsonUpdateGeneric with correct model type for SubmissionKind', async () => {
      const submissionKindId = 'test-submission-kind-id';
      const mockContent = { title: 'Test', description: 'Test description' };
      const updatedContent = { title: 'Updated', description: 'Updated description' };

      mockPrisma.submissionKind.findUnique.mockResolvedValue({
        id: submissionKindId,
        content: mockContent,
        occ: 1,
      });

      mockPrisma.submissionKind.update.mockResolvedValue({
        id: submissionKindId,
        content: updatedContent,
        occ: 2,
      });

      const modifyFn = vi.fn().mockReturnValue(updatedContent);

      const result = await safeSubmissionKindJsonUpdate(submissionKindId, modifyFn);

      expect(result).toEqual({
        id: submissionKindId,
        content: updatedContent,
        occ: 2,
      });
    });
  });
});
