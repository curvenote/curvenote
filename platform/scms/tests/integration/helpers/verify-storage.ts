// eslint-disable-next-line import/no-extraneous-dependencies
import { expect } from 'vitest';
import type { MockFolder, MockStorageBackend } from './mock-storage';
import { KnownBuckets } from '@curvenote/scms-core';

export function verifyFolderExists(folder: MockFolder) {
  expect(folder.exists).toHaveBeenCalled();
}

export function verifyFolderCopy(
  folder: MockFolder,
  expectedBucket: KnownBuckets,
  expectedPath: string,
) {
  expect(folder.copy).toHaveBeenCalledWith({
    bucket: expectedBucket,
    path: expectedPath,
  });
}

export function verifyStorageBackendOperations(backend: MockStorageBackend, expectedCdn: string) {
  expect(backend.knownBucketFromCDN).toHaveBeenCalledWith(expectedCdn);
  expect(backend.ensureConnection).toHaveBeenCalledWith(KnownBuckets.pub);
  expect(backend.cdnFromKnownBucket).toHaveBeenCalledWith(KnownBuckets.pub);
}
