// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  getDisplaySlug,
  getSlugAddFieldError,
  getSlugConfirmCopy,
  getSlugConfirmDialogError,
  resolveSlugMutationOutcome,
  getSuggestedSlugDraft,
  validateSlugForAdd,
} from './SlugManagerDialog.utils.js';
import { SUBMISSION_DETAIL_FORM_ACTIONS } from './SubmissionDetails.utils.js';

const sampleSlugs = [
  {
    id: '1',
    slug: 'primary-slug',
    primary: true,
    date_created: '2024-01-01',
    date_modified: '2024-01-02',
  },
  {
    id: '2',
    slug: 'secondary-slug',
    primary: false,
    date_created: '2024-01-01',
    date_modified: '2024-01-03',
  },
];

describe('getDisplaySlug', () => {
  it('prefers the primary slug, then first slug, then fallback', () => {
    expect(getDisplaySlug(sampleSlugs, 'fallback-id')).toBe('primary-slug');
    expect(getDisplaySlug([{ ...sampleSlugs[1], primary: false }], 'fallback-id')).toBe(
      'secondary-slug',
    );
    expect(getDisplaySlug([], 'fallback-id')).toBe('fallback-id');
  });
});

describe('getSuggestedSlugDraft', () => {
  it('returns the suggestion when it is not already used', () => {
    expect(getSuggestedSlugDraft('myst-journal-', [])).toBe('myst-journal-');
    expect(getSuggestedSlugDraft('myst-journal-', sampleSlugs)).toBe('myst-journal-');
    expect(getSuggestedSlugDraft('primary-slug', sampleSlugs)).toBeUndefined();
    expect(getSuggestedSlugDraft(undefined, sampleSlugs)).toBeUndefined();
  });
});

describe('validateSlugForAdd', () => {
  it('rejects empty, short, long, unsafe, uuid, and duplicate slugs', () => {
    expect(validateSlugForAdd('', sampleSlugs)).toBe('Enter a slug');
    expect(validateSlugForAdd('abc', sampleSlugs)).toMatch(/too short/i);
    expect(validateSlugForAdd('a'.repeat(65), sampleSlugs)).toMatch(/too long/i);
    expect(validateSlugForAdd('bad slug', sampleSlugs)).toMatch(/invalid characters/i);
    expect(validateSlugForAdd('01234567-89ab-cdef-0123-456789abcdef', sampleSlugs)).toMatch(
      /uuid/i,
    );
    expect(validateSlugForAdd('primary-slug', sampleSlugs)).toMatch(/already exists/i);
  });

  it('accepts a valid new slug', () => {
    expect(validateSlugForAdd('new-valid-slug', sampleSlugs)).toBeUndefined();
  });
});

describe('getSlugAddFieldError', () => {
  it('prefers the local error, then an add-action fetcher error', () => {
    const addFormData = new FormData();
    addFormData.set('formAction', SUBMISSION_DETAIL_FORM_ACTIONS.slugAdd);

    expect(
      getSlugAddFieldError({
        localError: 'too short',
        fetcherFormData: undefined,
        fetcherError: undefined,
      }),
    ).toBe('too short');
    expect(
      getSlugAddFieldError({
        localError: undefined,
        fetcherFormData: addFormData,
        fetcherError: 'server error',
      }),
    ).toBe('server error');
    expect(
      getSlugAddFieldError({
        localError: undefined,
        fetcherFormData: undefined,
        fetcherError: 'server error',
      }),
    ).toBeUndefined();
  });
});

describe('getSlugConfirmDialogError', () => {
  it('shows the fetcher error only for the matching confirm action', () => {
    const removeFormData = new FormData();
    removeFormData.set('formAction', SUBMISSION_DETAIL_FORM_ACTIONS.slugRemove);

    expect(
      getSlugConfirmDialogError({
        confirmTarget: { action: 'remove', slugId: '1', slug: 'qgr-2024' },
        fetcherFormData: removeFormData,
        fetcherError: 'cannot remove',
      }),
    ).toBe('cannot remove');
    expect(
      getSlugConfirmDialogError({
        confirmTarget: { action: 'primary', slugId: '1', slug: 'qgr-2024' },
        fetcherFormData: removeFormData,
        fetcherError: 'cannot remove',
      }),
    ).toBeUndefined();
    expect(
      getSlugConfirmDialogError({
        confirmTarget: null,
        fetcherFormData: removeFormData,
        fetcherError: 'cannot remove',
      }),
    ).toBeUndefined();
  });
});

describe('resolveSlugMutationOutcome', () => {
  it('maps fetcher data to outcomes', () => {
    expect(resolveSlugMutationOutcome(undefined)).toBe('pending');
    expect(resolveSlugMutationOutcome({ error: 'bad' })).toBe('error');
    expect(resolveSlugMutationOutcome({ slugs: sampleSlugs })).toBe('success');
    expect(resolveSlugMutationOutcome({})).toBe('pending');
  });
});

describe('getSlugConfirmCopy', () => {
  it('returns remove and primary copy', () => {
    expect(getSlugConfirmCopy('remove', 'qgr-2024').title).toBe('Remove slug');
    expect(getSlugConfirmCopy('remove', 'qgr-2024').description).toContain('qgr-2024');

    expect(getSlugConfirmCopy('primary', 'qgr-2024').title).toBe('Set primary slug');
    expect(getSlugConfirmCopy('primary', 'qgr-2024').confirmLabel).toBe('Set as primary');
  });
});
