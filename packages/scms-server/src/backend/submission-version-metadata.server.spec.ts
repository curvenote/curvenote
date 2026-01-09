// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  safelyPatchSubmissionVersionMetadata,
  safelyUpdateSubmissionVersionMetadata,
} from './submission-version-metadata.server.js';

// Mock dependencies
vi.mock('./occ.server', () => ({
  safeSubmissionVersionJsonUpdate: vi.fn(),
}));

vi.mock('@curvenote/scms-core', () => ({
  coerceToObject: vi.fn((value) => value || {}),
}));

// Mock react-router's data function to return a Response-like object
vi.mock('react-router', () => ({
  data: vi.fn((body, init) => {
    const response = {
      status: init?.status || 200,
      json: async () => body,
      headers: new Headers(),
      ok: (init?.status || 200) >= 200 && (init?.status || 200) < 300,
    };
    return response;
  }),
}));

describe('SubmissionVersion Metadata Utilities', () => {
  let mockSafeSubmissionVersionJsonUpdate: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { safeSubmissionVersionJsonUpdate } = await import('./occ.server.js');
    mockSafeSubmissionVersionJsonUpdate = vi.mocked(safeSubmissionVersionJsonUpdate);
  });

  describe('safelyPatchSubmissionVersionMetadata', () => {
    it('should patch metadata successfully', async () => {
      const submissionVersionId = 'test-submission-version-id';
      const metadataPatch = { test: 'value', nested: { key: 'value' } };

      mockSafeSubmissionVersionJsonUpdate.mockResolvedValue(undefined);

      const result = await safelyPatchSubmissionVersionMetadata(submissionVersionId, metadataPatch);

      expect(mockSafeSubmissionVersionJsonUpdate).toHaveBeenCalledWith(
        submissionVersionId,
        expect.any(Function),
      );
      // Success case returns plain object (not Response)
      expect(result).toEqual({ success: true });
    });

    it('should handle errors gracefully', async () => {
      const submissionVersionId = 'test-submission-version-id';
      const metadataPatch = { test: 'value' };

      const error = new Error('Database error');
      mockSafeSubmissionVersionJsonUpdate.mockRejectedValue(error);

      // Spy on console.error to suppress expected error output
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await safelyPatchSubmissionVersionMetadata(submissionVersionId, metadataPatch);

      // Error case returns Response object with status and json()
      expect((result as any).status).toBe(500);
      const body = (await (result as any).json()) as any;
      expect(body.error.type).toBe('general');
      expect(body.error.error).toBe('Failed to update metadata');
      expect(body.error.details.submissionVersionId).toBe(submissionVersionId);

      // Verify error was logged (even though we suppressed it)
      expect(consoleErrorSpy).toHaveBeenCalledWith(error);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('safelyUpdateSubmissionVersionMetadata', () => {
    it('should update metadata successfully', async () => {
      const submissionVersionId = 'test-submission-version-id';
      const updateFn = vi.fn().mockReturnValue({ version: 1, updated: true });

      mockSafeSubmissionVersionJsonUpdate.mockResolvedValue(undefined);

      const result = await safelyUpdateSubmissionVersionMetadata(submissionVersionId, updateFn);

      expect(mockSafeSubmissionVersionJsonUpdate).toHaveBeenCalledWith(
        submissionVersionId,
        expect.any(Function),
      );
      // Success case returns plain object (not Response)
      expect(result).toEqual({ success: true });
    });

    it('should handle errors gracefully', async () => {
      const submissionVersionId = 'test-submission-version-id';
      const updateFn = vi.fn().mockReturnValue({ version: 1, updated: true });

      const error = new Error('Database error');
      mockSafeSubmissionVersionJsonUpdate.mockRejectedValue(error);

      // Spy on console.error to suppress expected error output
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await safelyUpdateSubmissionVersionMetadata(submissionVersionId, updateFn);

      // Error case returns Response object with status and json()
      expect((result as any).status).toBe(500);
      const body = (await (result as any).json()) as any;
      expect(body.error.type).toBe('general');
      expect(body.error.error).toBe('Failed to update metadata');
      expect(body.error.details.submissionVersionId).toBe(submissionVersionId);

      // Verify error was logged (even though we suppressed it)
      expect(consoleErrorSpy).toHaveBeenCalledWith(error);
      consoleErrorSpy.mockRestore();
    });
  });
});
