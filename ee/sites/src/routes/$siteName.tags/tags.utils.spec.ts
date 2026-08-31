/* eslint-disable import/no-extraneous-dependencies */
import { describe, expect, test } from 'vitest';
import { TAG_LABEL_MAX_LENGTH } from '@curvenote/scms-core';
import {
  getCreateTagDuplicateError,
  getFetcherErrorParts,
  getTagDeleteCopy,
  getTagDialogAlertError,
  getTagDialogIdleAction,
  getTagFormFieldError,
  getTagEditLabelError,
  getTagLabelValidationError,
  getTagNamePreview,
  resolveTagCatalogOutcome,
} from './tags.utils.js';

describe('getTagNamePreview', () => {
  test('is empty when the label is blank', () => {
    expect(getTagNamePreview('   ')).toEqual({ name: '', status: 'empty' });
  });

  test('derives a valid name', () => {
    expect(getTagNamePreview('Blog Post')).toEqual({ name: 'blog-post', status: 'valid' });
  });

  test('marks a too-short derived name invalid', () => {
    expect(getTagNamePreview('ab')).toEqual({ name: 'ab', status: 'invalid' });
  });
});

describe('getTagEditLabelError', () => {
  test('rejects an empty or whitespace label', () => {
    expect(getTagEditLabelError('  ')).toBe(
      `tag label must be 1 to ${TAG_LABEL_MAX_LENGTH} characters`,
    );
  });

  test('accepts a short label whose derived name would be invalid on create', () => {
    expect(getTagEditLabelError('AI')).toBeUndefined();
  });

  test('accepts a valid label', () => {
    expect(getTagEditLabelError('Blog Post')).toBeUndefined();
  });

  test('rejects a label that exceeds the max length', () => {
    expect(getTagEditLabelError('a'.repeat(TAG_LABEL_MAX_LENGTH + 1))).toBe(
      `tag label must be 1 to ${TAG_LABEL_MAX_LENGTH} characters`,
    );
  });
});

describe('getTagLabelValidationError', () => {
  test('rejects an empty label with the same message as the server', () => {
    expect(getTagLabelValidationError('  ')).toBe(
      `tag label must be 1 to ${TAG_LABEL_MAX_LENGTH} characters`,
    );
  });

  test('rejects a too-short derived name with the same message as the server', () => {
    expect(getTagLabelValidationError('ab')).toBe('invalid tag name derived from label: "ab"');
  });

  test('accepts a valid label', () => {
    expect(getTagLabelValidationError('Blog Post')).toBeUndefined();
  });
});

describe('getCreateTagDuplicateError', () => {
  test('rejects a label whose derived name is already in the catalog', () => {
    expect(getCreateTagDuplicateError({ label: 'blog post', existingNames: ['blog-post'] })).toBe(
      'a tag with this name already exists',
    );
  });

  test('allows a new derived name', () => {
    expect(
      getCreateTagDuplicateError({ label: 'Case Study', existingNames: ['blog-post'] }),
    ).toBeUndefined();
  });
});

describe('fetcher error parts and field vs alert', () => {
  test('reads a string error as a general message', () => {
    expect(getFetcherErrorParts({ error: 'Forbidden' })).toEqual({
      message: 'Forbidden',
      field: undefined,
    });
  });

  test('reads a field error onto the label input', () => {
    expect(
      getFetcherErrorParts({
        error: { field: 'label', message: 'a tag with this name already exists' },
      }),
    ).toEqual({ field: 'label', message: 'a tag with this name already exists' });
  });

  test('prefers the local error, then a label-field fetcher error', () => {
    expect(
      getTagFormFieldError({
        localError: 'too short',
        fetcherError: 'server',
        fetcherField: 'label',
      }),
    ).toBe('too short');
    expect(
      getTagFormFieldError({
        localError: undefined,
        fetcherError: 'a tag with this name already exists',
        fetcherField: 'label',
      }),
    ).toBe('a tag with this name already exists');
    expect(
      getTagFormFieldError({
        localError: undefined,
        fetcherError: 'Forbidden',
        fetcherField: undefined,
      }),
    ).toBeUndefined();
  });

  test('shows non-field fetcher errors as a dialog alert', () => {
    expect(getTagDialogAlertError({ fetcherError: 'Forbidden', fetcherField: undefined })).toBe(
      'Forbidden',
    );
    expect(
      getTagDialogAlertError({ fetcherError: 'already exists', fetcherField: 'label' }),
    ).toBeUndefined();
  });
});

describe('resolveTagCatalogOutcome', () => {
  test('treats a tag or deleted flag as success', () => {
    expect(resolveTagCatalogOutcome(undefined)).toBe('pending');
    expect(resolveTagCatalogOutcome({ error: 'nope' })).toBe('error');
    expect(resolveTagCatalogOutcome({ tag: { id: 't1' } })).toBe('success');
    expect(resolveTagCatalogOutcome({ deleted: true })).toBe('success');
  });
});

describe('getTagDialogIdleAction', () => {
  test('closes on success after the fetcher returns to idle', () => {
    expect(
      getTagDialogIdleAction({
        awaitingResult: true,
        prevFetcherState: 'loading',
        currentFetcherState: 'idle',
        outcome: 'success',
      }),
    ).toEqual({ closeDialog: true, clearAwaiting: true });
  });

  test('keeps the dialog open on error', () => {
    expect(
      getTagDialogIdleAction({
        awaitingResult: true,
        prevFetcherState: 'loading',
        currentFetcherState: 'idle',
        outcome: 'error',
      }),
    ).toEqual({ closeDialog: false, clearAwaiting: true });
  });

  test('ignores idle when not awaiting a result', () => {
    expect(
      getTagDialogIdleAction({
        awaitingResult: false,
        prevFetcherState: 'loading',
        currentFetcherState: 'idle',
        outcome: 'success',
      }),
    ).toBeNull();
  });
});

describe('getTagDeleteCopy', () => {
  test('says the tag leaves the catalog, leaves every submission, and cannot be undone', () => {
    const copy = getTagDeleteCopy('Blog Post');
    expect(copy.title).toBe('Delete tag');
    expect(copy.description).toContain('catalog');
    expect(copy.description).toContain('every submission');
    expect(copy.description).toContain('cannot be undone');
    expect(copy.confirmLabel).toBe('Delete tag');
    expect(copy.submittingLabel).toBe('Deleting...');
  });
});
