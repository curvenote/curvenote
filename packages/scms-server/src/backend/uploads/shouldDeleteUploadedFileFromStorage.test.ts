// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { shouldDeleteUploadedFileFromStorage } from './shouldDeleteUploadedFileFromStorage.js';

describe('shouldDeleteUploadedFileFromStorage', () => {
  it('allows delete on latest version when path prefix matches cdn_key', () => {
    expect(
      shouldDeleteUploadedFileFromStorage({
        isLatestVersion: true,
        filePath: 'cdn-key-1/files/a.pdf',
        workVersionCdnKey: 'cdn-key-1',
        hasFileMetadata: true,
      }),
    ).toBe(true);
  });

  it('blocks delete when path references predecessor cdn_key', () => {
    expect(
      shouldDeleteUploadedFileFromStorage({
        isLatestVersion: true,
        filePath: 'old-key/files/a.pdf',
        workVersionCdnKey: 'new-key',
        hasFileMetadata: true,
      }),
    ).toBe(false);
  });

  it('blocks delete when not latest version', () => {
    expect(
      shouldDeleteUploadedFileFromStorage({
        isLatestVersion: false,
        filePath: 'cdn-key-1/files/a.pdf',
        workVersionCdnKey: 'cdn-key-1',
        hasFileMetadata: true,
      }),
    ).toBe(false);
  });

  it('blocks delete when file metadata is missing', () => {
    expect(
      shouldDeleteUploadedFileFromStorage({
        isLatestVersion: true,
        filePath: 'cdn-key-1/files/a.pdf',
        workVersionCdnKey: 'cdn-key-1',
        hasFileMetadata: false,
      }),
    ).toBe(false);
  });
});
