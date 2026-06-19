// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { deriveEtlThumbnailStorageKey } from './register-work-thumbnail.js';

describe('deriveEtlThumbnailStorageKey', () => {
  // ETL cdn_keys carry DOI dots; the CDN base URL (`getCdnBaseUrl`) replaces every dot
  // with a slash, so the bucket key the resolver signs must be dot-replaced too.
  const cdnKey = 'Batch_01/10.1101/2024.05.01.111111';
  const cdnKeyPath = 'Batch_01/10/1101/2024/05/01/111111';

  test('joins cdn_key path with a leading-slash thumbnail under public/', () => {
    expect(deriveEtlThumbnailStorageKey(cdnKey, { thumbnail: '/thumbnails/abc.png' })).toBe(
      `${cdnKeyPath}/public/thumbnails/abc.png`,
    );
  });

  test('joins cdn_key path with a relative thumbnail under public/', () => {
    expect(deriveEtlThumbnailStorageKey(cdnKey, { thumbnail: 'thumbnails/abc.png' })).toBe(
      `${cdnKeyPath}/public/thumbnails/abc.png`,
    );
  });

  test('falls back to thumbnailOptimized when thumbnail is absent', () => {
    expect(
      deriveEtlThumbnailStorageKey(cdnKey, { thumbnailOptimized: '/thumbnails/abc.webp' }),
    ).toBe(`${cdnKeyPath}/public/thumbnails/abc.webp`);
  });

  test('prefers thumbnail over thumbnailOptimized', () => {
    expect(
      deriveEtlThumbnailStorageKey(cdnKey, {
        thumbnail: '/thumbnails/a.png',
        thumbnailOptimized: '/thumbnails/a.webp',
      }),
    ).toBe(`${cdnKeyPath}/public/thumbnails/a.png`);
  });

  test('converts dotted cdn_key segments to a path', () => {
    expect(deriveEtlThumbnailStorageKey('site.work.v1', { thumbnail: '/t.png' })).toBe(
      'site/work/v1/public/t.png',
    );
  });

  test('strips a trailing slash on the cdn_key', () => {
    expect(deriveEtlThumbnailStorageKey(`${cdnKey}/`, { thumbnail: '/t.png' })).toBe(
      `${cdnKeyPath}/public/t.png`,
    );
  });

  test('returns undefined when metadata is missing', () => {
    expect(deriveEtlThumbnailStorageKey(cdnKey, undefined)).toBeUndefined();
  });

  test('returns undefined when no thumbnail field is present', () => {
    expect(deriveEtlThumbnailStorageKey(cdnKey, { title: 'x' })).toBeUndefined();
  });

  test('returns undefined for non-string thumbnail values', () => {
    expect(deriveEtlThumbnailStorageKey(cdnKey, { thumbnail: 123 })).toBeUndefined();
  });

  test('returns undefined for empty/whitespace thumbnail values', () => {
    expect(deriveEtlThumbnailStorageKey(cdnKey, { thumbnail: '   ' })).toBeUndefined();
  });

  test('returns undefined for absolute http(s) URLs we cannot sign', () => {
    expect(
      deriveEtlThumbnailStorageKey(cdnKey, { thumbnail: 'https://cdn.example.com/t.png' }),
    ).toBeUndefined();
    expect(
      deriveEtlThumbnailStorageKey(cdnKey, { thumbnail: '//cdn.example.com/t.png' }),
    ).toBeUndefined();
  });

  test('returns undefined for data URIs', () => {
    expect(
      deriveEtlThumbnailStorageKey(cdnKey, { thumbnail: 'data:image/png;base64,AAAA' }),
    ).toBeUndefined();
  });
});
