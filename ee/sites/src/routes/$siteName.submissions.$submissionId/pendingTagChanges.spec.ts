/* eslint-disable import/no-extraneous-dependencies */
import { describe, expect, test } from 'vitest';
import { SUBMISSION_DETAIL_FORM_ACTIONS } from './SubmissionDetails.utils.js';
import {
  applyPendingTagChanges,
  isTagFetcherKey,
  readPendingTagChanges,
  tagFetcherKey,
  type TagFetcherSnapshot,
} from './pendingTagChanges.js';

const { tagAssign: TAG_ASSIGN, tagRemove: TAG_REMOVE } = SUBMISSION_DETAIL_FORM_ACTIONS;
const SUBMISSION = '0190a0e0-0000-7000-8000-000000000001';
const BLOG = { id: 'id-blog', name: 'blog-post', label: 'Blog Post' };
const DATA = { id: 'id-data', name: 'dataset', label: 'Dataset' };
const ALPHA = { id: 'id-alpha', name: 'alpha', label: 'Alpha' };

function form(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

function tagFetcher(
  name: string,
  fields: Record<string, string>,
  state: TagFetcherSnapshot['state'] = 'submitting',
): TagFetcherSnapshot {
  return { key: tagFetcherKey(SUBMISSION, name), state, formData: form(fields) };
}

describe('tagFetcherKey', () => {
  test('is recognised for the same submission only', () => {
    const key = tagFetcherKey(SUBMISSION, 'blog-post');
    expect(isTagFetcherKey(SUBMISSION, key)).toBe(true);
    expect(isTagFetcherKey('other-submission', key)).toBe(false);
    expect(isTagFetcherKey(SUBMISSION, 'slug-fetcher')).toBe(false);
  });
});

describe('readPendingTagChanges', () => {
  test('reads assign, remove and create from in-flight tag fetchers', () => {
    const pending = readPendingTagChanges(
      [
        tagFetcher('blog-post', { formAction: TAG_ASSIGN, tag_id: BLOG.id }),
        tagFetcher('dataset', { formAction: TAG_REMOVE, tag_id: DATA.id }, 'loading'),
        tagFetcher('new-thing', { formAction: TAG_ASSIGN, label: ' New Thing ' }),
      ],
      SUBMISSION,
    );
    expect(pending).toEqual([
      { kind: 'assign', name: 'blog-post' },
      { kind: 'remove', name: 'dataset' },
      { kind: 'create', name: 'new-thing', label: 'New Thing' },
    ]);
  });

  test('ignores idle fetchers, other submissions and non-tag fetchers', () => {
    const pending = readPendingTagChanges(
      [
        tagFetcher('blog-post', { formAction: TAG_ASSIGN, tag_id: BLOG.id }, 'idle'),
        {
          key: tagFetcherKey('other-submission', 'dataset'),
          state: 'submitting',
          formData: form({ formAction: TAG_REMOVE, tag_id: DATA.id }),
        },
        { key: 'slug', state: 'submitting', formData: form({ formAction: 'slug-add' }) },
      ],
      SUBMISSION,
    );
    expect(pending).toEqual([]);
  });
});

describe('applyPendingTagChanges', () => {
  test('returns server data unchanged when nothing is pending', () => {
    const view = applyPendingTagChanges({ tags: [BLOG], catalog: [BLOG, DATA], pending: [] });
    expect(view).toEqual({ tags: [BLOG], catalog: [BLOG, DATA], busyNames: [] });
  });

  test('shows an assigned tag and hides a removed one, sorted by label', () => {
    const view = applyPendingTagChanges({
      tags: [DATA],
      catalog: [ALPHA, BLOG, DATA],
      pending: [
        { kind: 'assign', name: 'blog-post' },
        { kind: 'assign', name: 'alpha' },
        { kind: 'remove', name: 'dataset' },
      ],
    });
    expect(view.tags).toEqual([ALPHA, BLOG]);
    expect(view.busyNames).toEqual(['blog-post', 'alpha', 'dataset']);
  });

  test('adds a created tag to tags and catalog without an id', () => {
    const view = applyPendingTagChanges({
      tags: [],
      catalog: [BLOG],
      pending: [{ kind: 'create', name: 'new-thing', label: 'New Thing' }],
    });
    const created = { id: undefined, name: 'new-thing', label: 'New Thing' };
    expect(view.tags).toEqual([created]);
    expect(view.catalog).toEqual([BLOG, created]);
  });

  test('keeps the server row once revalidation already contains the created tag', () => {
    const saved = { id: 'id-new', name: 'new-thing', label: 'New Thing' };
    const view = applyPendingTagChanges({
      tags: [saved],
      catalog: [saved],
      pending: [{ kind: 'create', name: 'new-thing', label: 'New Thing' }],
    });
    expect(view.tags).toEqual([saved]);
    expect(view.catalog).toEqual([saved]);
  });

  test('is idempotent when revalidation already reflects a pending assign', () => {
    const view = applyPendingTagChanges({
      tags: [BLOG],
      catalog: [BLOG],
      pending: [{ kind: 'assign', name: 'blog-post' }],
    });
    expect(view.tags).toEqual([BLOG]);
  });

  test('ignores an assign for a tag missing from the catalog', () => {
    const view = applyPendingTagChanges({
      tags: [],
      catalog: [BLOG],
      pending: [{ kind: 'assign', name: 'deleted-tag' }],
    });
    expect(view.tags).toEqual([]);
  });
});
