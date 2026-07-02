/* eslint-disable import/no-extraneous-dependencies */
import { describe, expect, it } from 'vitest';
import {
  canSiteAcceptNewSubmission,
  isAlreadySubmittedVersion,
  isSiteAvailableForWorkSubmit,
  resolveOpenCollection,
  resolveSubmissionKind,
} from './submitToSite.server';

const baseSite = {
  id: 'site-1',
  name: 'site-1',
  external: false,
  private: false,
  restricted: false,
};

describe('submitToSite.server', () => {
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
});
