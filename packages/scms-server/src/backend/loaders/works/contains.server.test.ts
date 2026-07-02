// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { WorkContents } from '@curvenote/scms-core';
import {
  draftUploadVersionContains,
  mergeWorkContains,
  resolveVersionContains,
} from './contains.server.js';

describe('resolveVersionContains', () => {
  it('defaults undefined to myst', () => {
    expect(resolveVersionContains(undefined)).toEqual(['myst']);
  });

  it('uses a custom fallback when undefined', () => {
    expect(resolveVersionContains(undefined, [WorkContents.FILES])).toEqual(['files']);
  });

  it('preserves explicit empty array', () => {
    expect(resolveVersionContains([])).toEqual([]);
  });

  it('dedupes requested values', () => {
    expect(resolveVersionContains(['myst', 'myst', 'files'])).toEqual(['myst', 'files']);
  });
});

describe('draftUploadVersionContains', () => {
  it('inherits prior version labels and adds files when missing', () => {
    expect(draftUploadVersionContains(['myst'])).toEqual(['myst', 'files']);
  });

  it('does not duplicate files when already present', () => {
    expect(draftUploadVersionContains(['myst', 'files'])).toEqual(['myst', 'files']);
  });

  it('adds files to an empty prior version', () => {
    expect(draftUploadVersionContains([])).toEqual(['files']);
  });
});

describe('mergeWorkContains', () => {
  it('merges existing and incoming labels', () => {
    expect(mergeWorkContains(['myst'], ['files'])).toEqual(['myst', 'files']);
  });

  it('dedupes overlapping labels', () => {
    expect(mergeWorkContains(['myst', 'files'], ['files', 'meca'])).toEqual([
      'myst',
      'files',
      'meca',
    ]);
  });

  it('treats nullish existing as empty', () => {
    expect(mergeWorkContains(null, ['myst'])).toEqual(['myst']);
    expect(mergeWorkContains(undefined, ['files'])).toEqual(['files']);
  });
});
