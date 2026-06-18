// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { decodeFigureLocator, encodeFigureLocator } from './thumbnailSelection';

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
