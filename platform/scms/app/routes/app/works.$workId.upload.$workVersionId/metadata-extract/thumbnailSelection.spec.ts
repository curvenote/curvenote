// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { decodeFigureLocator, encodeFigureLocator } from './thumbnailSelection';

describe('thumbnail selection locators', () => {
  it('round-trips source paths and figure indices', () => {
    const locator = encodeFigureLocator({
      sourcePath: 'uploads/manuscript.v1.pdf',
      figureIndex: 3,
    });

    expect(decodeFigureLocator(locator)).toEqual({
      sourcePath: 'uploads/manuscript.v1.pdf',
      figureIndex: 3,
    });
  });

  it('uses the last separator so paths can contain separator-like content', () => {
    const sourcePath = `uploads/with\u0000separator.pdf`;
    const locator = encodeFigureLocator({ sourcePath, figureIndex: 1 });

    expect(decodeFigureLocator(locator)).toEqual({ sourcePath, figureIndex: 1 });
  });

  it.each([
    ['missing separator', 'uploads/manuscript.pdf'],
    ['empty source path', '\u00000'],
    ['non-numeric figure index', 'uploads/manuscript.pdf\u0000not-a-number'],
    ['negative figure index', 'uploads/manuscript.pdf\u0000-1'],
  ])('rejects malformed locator: %s', (_name, locator) => {
    expect(decodeFigureLocator(locator)).toBeNull();
  });
});
