// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  documentPreviewCacheId,
  previewCandidateMd5s,
  previewCacheObjectIds,
} from './documentPreviewCache.js';

describe('documentPreviewCacheId', () => {
  it('scopes cache id by work version and md5', () => {
    expect(documentPreviewCacheId('wv-1', 'abc123')).toBe('docx:preview:v3:wv-1:abc123');
  });
});

describe('previewCandidateMd5s', () => {
  it('returns empty for missing or invalid metadata', () => {
    expect(previewCandidateMd5s(null)).toEqual([]);
    expect(previewCandidateMd5s(undefined)).toEqual([]);
    expect(previewCandidateMd5s({})).toEqual([]);
    expect(previewCandidateMd5s({ files: null })).toEqual([]);
  });

  it('collects md5 from preview-candidate files only', () => {
    expect(
      previewCandidateMd5s({
        files: {
          a: {
            path: 'k/a.pdf',
            type: 'application/pdf',
            md5: 'pdf-md5',
          },
          b: {
            path: 'k/b.txt',
            type: 'text/plain',
            md5: 'txt-md5',
          },
        },
      }),
    ).toEqual(['pdf-md5']);
  });

  it('dedupes identical md5s', () => {
    expect(
      previewCandidateMd5s({
        files: {
          a: { path: 'a.pdf', type: 'application/pdf', md5: 'same' },
          b: { path: 'b.pdf', type: 'application/pdf', md5: 'same' },
        },
      }),
    ).toEqual(['same']);
  });

  it('skips entries without md5', () => {
    expect(
      previewCandidateMd5s({
        files: {
          a: { path: 'a.pdf', type: 'application/pdf' },
        },
      }),
    ).toEqual([]);
  });
});

describe('previewCacheObjectIds', () => {
  it('maps md5s to version-scoped object ids', () => {
    expect(
      previewCacheObjectIds('wv-2', {
        files: {
          a: { path: 'a.pdf', type: 'application/pdf', md5: 'm1' },
        },
      }),
    ).toEqual(['docx:preview:v3:wv-2:m1']);
  });
});
