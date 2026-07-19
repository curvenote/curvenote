// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  buildThumbnailCandidateLocators,
  decodeFigureLocator,
  encodeFigureLocator,
  resolveThumbnailSelection,
} from './thumbnailSelection';

describe('thumbnail selection locators', () => {
  it('round-trips a storage key', () => {
    const key = 'uploads/abc123/thumbnails/preview-md5-3.webp';
    expect(decodeFigureLocator(encodeFigureLocator(key))).toBe(key);
  });

  it('trims surrounding whitespace', () => {
    expect(decodeFigureLocator('  uploads/x/thumbnails/preview-0.webp  ')).toBe(
      'uploads/x/thumbnails/preview-0.webp',
    );
  });

  it.each([
    ['empty string', ''],
    ['whitespace only', '   '],
  ])('rejects malformed locator: %s', (_name, locator) => {
    expect(decodeFigureLocator(locator)).toBeNull();
  });
});

describe('resolveThumbnailSelection', () => {
  it('keeps an explicit selection when it appears in locators', () => {
    expect(resolveThumbnailSelection(['a', 'b'], 'b')).toBe('b');
  });

  it('falls back to the first locator when selection is absent', () => {
    expect(resolveThumbnailSelection(['a', 'b'], null)).toBe('a');
  });

  it('returns null when locators are empty', () => {
    expect(resolveThumbnailSelection([], 'a')).toBeNull();
  });
});

describe('buildThumbnailCandidateLocators', () => {
  it('prepends the inherited locator and dedupes preview figures', () => {
    const inherited = 'uploads/v1/thumb.webp';
    const previewFigures = [inherited, 'uploads/v1/thumbnails/preview-0.webp'];
    expect(buildThumbnailCandidateLocators(previewFigures, inherited)).toEqual([
      inherited,
      'uploads/v1/thumbnails/preview-0.webp',
    ]);
  });

  it('preserves inherited selection when previews use different figure keys', () => {
    const inherited = 'uploads/old/thumb.webp';
    const previewFigures = ['uploads/new/thumbnails/preview-0.webp'];
    const locators = buildThumbnailCandidateLocators(previewFigures, inherited);

    expect(resolveThumbnailSelection(locators, inherited)).toBe(inherited);
    expect(resolveThumbnailSelection(previewFigures, inherited)).toBe(previewFigures[0]);
  });
});
