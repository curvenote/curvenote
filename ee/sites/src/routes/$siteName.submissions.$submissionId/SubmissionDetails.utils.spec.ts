// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  SUBMISSION_DETAIL_FORM_ACTIONS,
  SUBMISSION_DETAIL_FIELDS,
  emptyDetailValue,
  getEditableFields,
  getStatusBanners,
  getVisibleDetailFields,
  versionCountLabel,
} from './SubmissionDetails.utils.js';

describe('versionCountLabel', () => {
  it('uses singular form for one version', () => {
    expect(versionCountLabel(1)).toBe('1 version');
  });

  it('uses plural form for multiple versions', () => {
    expect(versionCountLabel(2)).toBe('2 versions');
    expect(versionCountLabel(5)).toBe('5 versions');
  });
});

describe('emptyDetailValue', () => {
  it('returns the standard empty placeholder', () => {
    expect(emptyDetailValue()).toBe('Not assigned');
  });
});

describe('getVisibleDetailFields', () => {
  it('lists the submission detail fields without mystProjectKey', () => {
    expect(getVisibleDetailFields()).toEqual([
      'publicationDate',
      'collection',
      'kind',
      'slug',
      'doi',
    ]);
    expect(getVisibleDetailFields()).not.toContain('mystProjectKey');
  });
});

describe('getEditableFields', () => {
  it('returns no editable fields when updates are not allowed', () => {
    expect(getEditableFields(false)).toEqual([]);
  });

  it('returns editable fields when updates are allowed', () => {
    expect(getEditableFields(true)).toEqual(['publicationDate', 'collection', 'kind', 'slug']);
    expect(getEditableFields(true)).not.toContain('doi');
    expect(getEditableFields(true)).not.toContain('mystProjectKey');
  });
});

describe('SUBMISSION_DETAIL_FORM_ACTIONS', () => {
  it('preserves the edit action contract', () => {
    expect(SUBMISSION_DETAIL_FORM_ACTIONS).toEqual({
      setDatePublished: 'set-date-published',
      setCollection: 'set-collection',
      setKind: 'set-kind',
      slugAdd: 'slug-add',
      slugRemove: 'slug-remove',
      slugSetPrimary: 'slug-set-primary',
    });
  });
});

describe('SUBMISSION_DETAIL_FIELDS', () => {
  it('exposes field keys used by the detail card', () => {
    expect(SUBMISSION_DETAIL_FIELDS.publicationDate).toBe('publicationDate');
    expect(SUBMISSION_DETAIL_FIELDS.doi).toBe('doi');
    expect(SUBMISSION_DETAIL_FIELDS).not.toHaveProperty('mystProjectKey');
  });
});

describe('getStatusBanners', () => {
  const baseUrl = 'https://example.com';
  const signature = 'sig-123';
  const activeVersion = {
    id: 'version-active',
    date_created: '2022-05-20T14:00:00.000Z',
    status: 'IN_REVIEW',
  };
  const publishedVersion = {
    id: 'version-published',
    date_created: '2022-05-11T01:00:00.000Z',
    site_work: { id: 'work-published' },
  };

  it('returns only a published banner when the active version is published', () => {
    const result = getStatusBanners({
      baseUrl,
      signature,
      activeVersion: { ...activeVersion, status: 'PUBLISHED' },
      activeStatusLabel: 'PUBLISHED',
      hasActiveNotPublished: false,
      publishedVersion,
      submissionSlug: 'nn00000',
    });

    expect(result).toEqual([
      {
        kind: 'published',
        dateCreated: '2022-05-11T01:00:00.000Z',
        href: 'https://example.com/articles/nn00000',
      },
    ]);
  });

  it('returns only a preview banner when the active version is not published', () => {
    const result = getStatusBanners({
      baseUrl,
      signature,
      activeVersion,
      activeStatusLabel: 'In Review',
      hasActiveNotPublished: true,
      publishedVersion: undefined,
      submissionSlug: undefined,
    });

    expect(result).toEqual([
      {
        kind: 'preview',
        dateCreated: '2022-05-20T14:00:00.000Z',
        status: 'IN_REVIEW',
        statusLabel: 'In Review',
        href: 'https://example.com/previews/version-active?preview=sig-123',
      },
    ]);
  });

  it('returns published then preview when both states apply', () => {
    const result = getStatusBanners({
      baseUrl,
      signature,
      activeVersion,
      activeStatusLabel: 'In Review',
      hasActiveNotPublished: true,
      publishedVersion,
      submissionSlug: 'nn00000',
    });

    expect(result).toEqual([
      {
        kind: 'published',
        dateCreated: '2022-05-11T01:00:00.000Z',
        href: 'https://example.com/articles/nn00000',
      },
      {
        kind: 'preview',
        dateCreated: '2022-05-20T14:00:00.000Z',
        status: 'IN_REVIEW',
        statusLabel: 'In Review',
        href: 'https://example.com/previews/version-active?preview=sig-123',
      },
    ]);
  });

  it('falls back to the published work id when no slug is set', () => {
    const result = getStatusBanners({
      baseUrl,
      signature,
      activeVersion: { ...activeVersion, status: 'PUBLISHED' },
      activeStatusLabel: 'PUBLISHED',
      hasActiveNotPublished: false,
      publishedVersion,
      submissionSlug: undefined,
    });

    expect(result[0]).toMatchObject({
      kind: 'published',
      href: 'https://example.com/articles/work-published',
    });
  });
});
