// eslint-disable-next-line import/no-extraneous-dependencies
import { vi } from 'vitest';
import { KnownBuckets } from '@curvenote/scms-core';

export interface MockFolder {
  exists: ReturnType<typeof vi.fn>;
  copy: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  move: ReturnType<typeof vi.fn>;
}

export class MockStorageBackend {
  knownBucketFromCDN: ReturnType<typeof vi.fn>;
  ensureConnection: ReturnType<typeof vi.fn>;
  cdnFromKnownBucket: ReturnType<typeof vi.fn>;
  folder: MockFolder;

  constructor() {
    this.knownBucketFromCDN = vi.fn().mockImplementation((cdn) => {
      if (cdn === 'https://test-cdn.com') return KnownBuckets.pub;
      if (cdn === 'https://test-cdn-prv.com/') return KnownBuckets.prv;
      return null;
    });
    this.ensureConnection = vi.fn().mockResolvedValue(undefined);
    this.cdnFromKnownBucket = vi.fn().mockImplementation((bucket) => {
      if (bucket === KnownBuckets.pub) return 'https://test-cdn.com';
      if (bucket === KnownBuckets.prv) return 'https://test-cdn-prv.com';
      return null;
    });
    this.folder = createMockFolder();
  }

  createFolder(_key: string, bucket: KnownBuckets) {
    // Call the mock as a function - this is intentionally a floating promise for testing
    (this.ensureConnection as any)(bucket);
    return this.folder;
  }
}

export function createMockFolder(): MockFolder {
  return {
    exists: vi.fn().mockResolvedValue(true),
    copy: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    move: vi.fn().mockResolvedValue(undefined),
  };
}

export function createMockStorageBackend(): MockStorageBackend {
  return new MockStorageBackend();
}

export function setupMockStorage() {
  const mockBackend = createMockStorageBackend();
  vi.mock('~/backend/storage', () => ({
    StorageBackend: vi.fn().mockImplementation(() => mockBackend),
    KnownBuckets: {
      pub: 'pub',
      private: 'private',
      tmp: 'tmp',
      cdn: 'cdn',
      prv: 'prv',
      staging: 'staging',
      hashstore: 'hashstore',
    },
    Folder: vi.fn().mockImplementation(() => mockBackend.folder),
  }));
  return mockBackend;
}

export function getMockStorageBackend(): MockStorageBackend {
  return createMockStorageBackend();
}
