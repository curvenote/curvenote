// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  buildAttributeChangeOptions,
  getFetcherIdleDialogAction,
  getOptimisticNameOrTitle,
  resolveCollectionChangeOutcome,
  resolveKindChangeOutcome,
} from './AttributeChangeDialog.utils.js';

describe('buildAttributeChangeOptions', () => {
  it('uses title when present, otherwise name', () => {
    expect(
      buildAttributeChangeOptions([
        { id: '1', name: 'blog-posts', content: { title: 'Blog Posts' } },
        { id: '2', name: 'articles' },
      ]),
    ).toEqual([
      { id: '1', label: 'Blog Posts' },
      { id: '2', label: 'articles' },
    ]);
  });
});

describe('getOptimisticNameOrTitle', () => {
  it('prefers formData name_or_title over fallbacks', () => {
    const formData = new FormData();
    formData.set('name_or_title', 'From form');

    expect(getOptimisticNameOrTitle(formData, 'Fallback', 'Other')).toBe('From form');
    expect(getOptimisticNameOrTitle(undefined, 'Fallback', 'Other')).toBe('Fallback');
    expect(getOptimisticNameOrTitle(undefined, undefined, 'Other')).toBe('Other');
    expect(getOptimisticNameOrTitle(undefined)).toBeUndefined();
  });
});

describe('resolveCollectionChangeOutcome', () => {
  it('maps fetcher data to outcomes', () => {
    expect(resolveCollectionChangeOutcome(undefined)).toBe('pending');
    expect(resolveCollectionChangeOutcome({ error: 'bad' })).toBe('error');
    expect(resolveCollectionChangeOutcome({ collection: { id: 'c1' } })).toBe('success');
    expect(resolveCollectionChangeOutcome({})).toBe('pending');
  });
});

describe('resolveKindChangeOutcome', () => {
  it('maps fetcher data to outcomes', () => {
    expect(resolveKindChangeOutcome(undefined)).toBe('pending');
    expect(resolveKindChangeOutcome({ error: 'bad' })).toBe('error');
    expect(resolveKindChangeOutcome({ kindId: 'k1' })).toBe('success');
    expect(resolveKindChangeOutcome({})).toBe('pending');
  });
});

describe('getFetcherIdleDialogAction', () => {
  it('closes the dialog on success after a submit completes', () => {
    expect(getFetcherIdleDialogAction(true, 'submitting', 'idle', 'success')).toEqual({
      closeDialog: true,
      clearAwaiting: true,
    });
  });

  it('keeps the dialog open on error after a submit completes', () => {
    expect(getFetcherIdleDialogAction(true, 'loading', 'idle', 'error')).toEqual({
      closeDialog: false,
      clearAwaiting: true,
    });
  });

  it('does nothing when not awaiting or fetcher did not return to idle', () => {
    expect(getFetcherIdleDialogAction(false, 'submitting', 'idle', 'success')).toBeNull();
    expect(getFetcherIdleDialogAction(true, 'idle', 'submitting', 'pending')).toBeNull();
    expect(getFetcherIdleDialogAction(true, 'submitting', 'idle', 'pending')).toBeNull();
  });
});
