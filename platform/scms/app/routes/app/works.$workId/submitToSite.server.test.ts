/* eslint-disable import/no-extraneous-dependencies */
import { describe, expect, it, vi } from 'vitest';
import {
  canSiteAcceptNewSubmission,
  isAlreadySubmittedVersion,
  isSiteAvailableForWorkSubmit,
  resolveOpenCollection,
  resolveSubmissionKind,
  submitWorkVersionToSite,
  workSiteSubmitLockKey,
} from './submitToSite.server';

const baseSite = {
  id: 'site-1',
  name: 'site-1',
  external: false,
  private: false,
  restricted: false,
};

describe('submitToSite.server', () => {
  it('builds a stable work/site advisory lock key', () => {
    expect(workSiteSubmitLockKey('work-1', 'site-1')).toBe('work-site-submit:work-1:site-1');
  });

  it('resolves default open collection first', () => {
    const collections = [
      { id: 'closed-default', default: true, open: false, kindsInCollection: [] },
      { id: 'open-other', default: false, open: true, kindsInCollection: [] },
    ];
    expect(resolveOpenCollection(collections)?.id).toBe('open-other');
  });

  it('requires a submission kind for new submissions', () => {
    expect(
      canSiteAcceptNewSubmission({
        collections: [
          {
            id: 'collection-1',
            default: true,
            open: true,
            kindsInCollection: [],
          },
        ],
        submissionKinds: [],
      }),
    ).toBe(false);

    expect(
      canSiteAcceptNewSubmission({
        collections: [
          {
            id: 'collection-1',
            default: true,
            open: true,
            kindsInCollection: [{ kind: { id: 'kind-1', default: true } }],
          },
        ],
        submissionKinds: [],
      }),
    ).toBe(true);
  });

  it('falls back to site submission kinds when collection kinds are empty', () => {
    const collection = {
      id: 'collection-1',
      default: true,
      open: true,
      kindsInCollection: [],
    };
    expect(resolveSubmissionKind(collection, [{ id: 'site-kind', default: true }])).toEqual({
      id: 'site-kind',
      default: true,
    });
  });

  it('allows sites with an existing work submission regardless of collection state', () => {
    const site = {
      ...baseSite,
      collections: [{ id: 'collection-1', default: true, open: false, kindsInCollection: [] }],
      submissionKinds: [],
    };
    expect(
      isSiteAvailableForWorkSubmit({ system_scopes: [], site_roles: [] }, site, new Set()),
    ).toBe(false);
    expect(
      isSiteAvailableForWorkSubmit(
        { system_scopes: [], site_roles: [] },
        site,
        new Set(['site-1']),
      ),
    ).toBe(true);
  });

  it('treats only non-draft submission versions as already submitted', () => {
    const version = { id: 'sv-1', work_version_id: 'wv-1', status: 'PENDING' };
    expect(isAlreadySubmittedVersion(version, 'wv-1')).toBe(true);
    expect(isAlreadySubmittedVersion({ ...version, status: 'DRAFT' }, 'wv-1')).toBe(false);
    expect(isAlreadySubmittedVersion(version, 'wv-2')).toBe(false);
  });

  it('returns an existing submission version for an older work version after a newer one was submitted', async () => {
    const createSubmissionVersion = vi.fn(async () => ({ id: 'sv-duplicate' }));
    const result = await submitWorkVersionToSite(
      {
        findExistingSubmission: async () => ({
          id: 'submission-1',
          versions: [{ id: 'sv-old', work_version_id: 'wv-1', status: 'PENDING' }],
        }),
      },
      {
        createSubmissionVersion,
        createNewSubmissionReturningVersion: vi.fn(),
      },
      'wv-1',
      'public-site',
    );

    expect(result).toMatchObject({
      success: true,
      siteName: 'public-site',
      submissionVersionId: 'sv-old',
      alreadySubmitted: true,
    });
    expect(createSubmissionVersion).not.toHaveBeenCalled();
  });

  it('creates a new submission when none exists for the work/site pair', async () => {
    const result = await submitWorkVersionToSite(
      {
        findExistingSubmission: async () => null,
      },
      {
        createSubmissionVersion: vi.fn(),
        createNewSubmissionReturningVersion: vi.fn(async () => ({ id: 'sv-new' })),
      },
      'wv-1',
      'public-site',
    );

    expect(result).toMatchObject({
      success: true,
      siteName: 'public-site',
      submissionVersionId: 'sv-new',
    });
  });

  it('adds a version when an existing submission has only a draft for the work version', async () => {
    const createSubmissionVersion = vi.fn(async () => ({ id: 'sv-pending' }));
    const result = await submitWorkVersionToSite(
      {
        findExistingSubmission: async () => ({
          id: 'submission-1',
          versions: [{ id: 'sv-draft', work_version_id: 'wv-1', status: 'DRAFT' }],
        }),
      },
      {
        createSubmissionVersion,
        createNewSubmissionReturningVersion: vi.fn(),
      },
      'wv-1',
      'public-site',
    );

    expect(result).toMatchObject({
      success: true,
      siteName: 'public-site',
      submissionVersionId: 'sv-pending',
    });
    expect(createSubmissionVersion).toHaveBeenCalledWith('submission-1');
  });
});
