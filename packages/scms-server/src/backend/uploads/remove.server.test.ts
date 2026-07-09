// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shouldDeleteUploadedFileFromStorage } from './shouldDeleteUploadedFileFromStorage.js';

const mockSafeWorkVersionJsonUpdate = vi.fn();
const mockGetPrismaClient = vi.fn();
const mockFileDelete = vi.fn();
const mockFileExists = vi.fn();

vi.mock('../occ.server.js', () => ({
  safeWorkVersionJsonUpdate: (...args: unknown[]) => mockSafeWorkVersionJsonUpdate(...args),
}));

vi.mock('../prisma.server.js', () => ({
  getPrismaClient: () => mockGetPrismaClient(),
}));

vi.mock('../storage/file.server.js', () => ({
  File: class MockFile {
    constructor(_backend: unknown, _path: string, _bucket: unknown) {}

    exists() {
      return mockFileExists();
    }

    delete() {
      return mockFileDelete();
    }
  },
}));

vi.mock('../storage/backend.server.js', () => ({
  StorageBackend: class MockStorageBackend {
    knownBucketFromCDN() {
      return 'prv';
    }
  },
}));

vi.mock('../storage/constants.server.js', () => ({
  KnownBuckets: { prv: 'prv', tmp: 'tmp', pub: 'pub' },
}));

vi.mock('./shouldDeleteUploadedFileFromStorage.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./shouldDeleteUploadedFileFromStorage.js')>();
  return {
    ...actual,
    shouldDeleteUploadedFileFromStorage: vi.fn(actual.shouldDeleteUploadedFileFromStorage),
  };
});

import { workVersionUploadRemove } from './remove.server.js';

describe('workVersionUploadRemove', () => {
  const ctx = {
    work: {
      id: 'work-1',
      versions: [
        { id: 'wv-latest', cdn_key: 'new-key' },
        { id: 'wv-old', cdn_key: 'old-key' },
      ],
    },
    trackEvent: vi.fn(),
  } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPrismaClient.mockResolvedValue({
      workVersion: {
        findUnique: vi.fn().mockResolvedValue({
          metadata: { files: { 'old-key/a.pdf': { slot: 'manuscript' } } },
        }),
      },
    });
    mockSafeWorkVersionJsonUpdate.mockResolvedValue(undefined);
    mockFileExists.mockResolvedValue(true);
    mockFileDelete.mockResolvedValue(undefined);
  });

  it('delegates storage deletion policy to shouldDeleteUploadedFileFromStorage', async () => {
    const formData = new FormData();
    formData.set('path', 'old-key/a.pdf');
    formData.set('slot', 'manuscript');

    await workVersionUploadRemove(ctx, formData, 'wv-latest', 'cdn://x');

    expect(shouldDeleteUploadedFileFromStorage).toHaveBeenCalledWith({
      isLatestVersion: true,
      filePath: 'old-key/a.pdf',
      workVersionCdnKey: 'new-key',
      hasFileMetadata: true,
    });
    expect(mockFileDelete).not.toHaveBeenCalled();
    expect(mockSafeWorkVersionJsonUpdate).toHaveBeenCalled();
  });

  it('deletes storage when helper returns true', async () => {
    vi.mocked(shouldDeleteUploadedFileFromStorage).mockReturnValueOnce(true);

    const formData = new FormData();
    formData.set('path', 'new-key/a.pdf');
    formData.set('slot', 'manuscript');

    mockGetPrismaClient.mockResolvedValue({
      workVersion: {
        findUnique: vi.fn().mockResolvedValue({
          metadata: { files: { 'new-key/a.pdf': { slot: 'manuscript' } } },
        }),
      },
    });

    await workVersionUploadRemove(ctx, formData, 'wv-latest', 'cdn://x');

    expect(mockFileDelete).toHaveBeenCalled();
  });
});
