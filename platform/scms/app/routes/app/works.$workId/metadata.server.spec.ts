// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, vi } from 'vitest';
import {
  computeCanResumeDraftUpload,
  resolveWorkVersionDoi,
  signVersionFilesForClient,
} from './metadata.server';

vi.mock('@curvenote/scms-server', () => ({
  signFilesInMetadata: vi.fn(async (meta: { files?: Record<string, unknown> }) => meta),
}));

describe('signVersionFilesForClient', () => {
  it('returns signed files only and ignores extension metadata keys', async () => {
    const result = await signVersionFilesForClient(
      { cdn: 'https://cdn.example' },
      {
        foundry: { wizard: { furthest: 'confirm' } },
        files: { 'a.pdf': { path: 'a.pdf' } },
      },
      {} as Parameters<typeof signVersionFilesForClient>[2],
    );

    expect(result).toEqual({ files: { 'a.pdf': { path: 'a.pdf' } } });
    expect(result).not.toHaveProperty('foundry');
  });

  it('returns undefined when there are no files', async () => {
    const result = await signVersionFilesForClient(
      { cdn: 'https://cdn.example' },
      { foundry: { wizard: { furthest: 'confirm' } } },
      {} as Parameters<typeof signVersionFilesForClient>[2],
    );

    expect(result).toBeUndefined();
  });
});

describe('computeCanResumeDraftUpload', () => {
  it('allows resume when user can upload and latest version is draft', () => {
    expect(computeCanResumeDraftUpload(true, { draft: true })).toBe(true);
  });

  it('denies resume when latest version is not draft', () => {
    expect(computeCanResumeDraftUpload(true, { draft: false })).toBe(false);
  });

  it('denies resume when user cannot upload', () => {
    expect(computeCanResumeDraftUpload(false, { draft: true })).toBe(false);
  });
});

describe('resolveWorkVersionDoi', () => {
  it('prefers a non-empty version DOI', () => {
    expect(resolveWorkVersionDoi('10.1234/version', '10.1234/work')).toBe('10.1234/version');
  });

  it('falls back to work DOI when version DOI is empty or whitespace', () => {
    expect(resolveWorkVersionDoi('', '10.1234/work')).toBe('10.1234/work');
    expect(resolveWorkVersionDoi('   ', '10.1234/work')).toBe('10.1234/work');
  });

  it('falls back to work DOI when version DOI is null or undefined', () => {
    expect(resolveWorkVersionDoi(null, '10.1234/work')).toBe('10.1234/work');
    expect(resolveWorkVersionDoi(undefined, '10.1234/work')).toBe('10.1234/work');
  });

  it('returns null when both version and work DOI are unset or blank', () => {
    expect(resolveWorkVersionDoi('', null)).toBeNull();
    expect(resolveWorkVersionDoi('  ', ' ')).toBeNull();
    expect(resolveWorkVersionDoi(null, undefined)).toBeNull();
  });

  it('trims whitespace from the chosen DOI', () => {
    expect(resolveWorkVersionDoi('  10.1234/version  ', '10.1234/work')).toBe('10.1234/version');
    expect(resolveWorkVersionDoi('', '  10.1234/work  ')).toBe('10.1234/work');
  });
});
