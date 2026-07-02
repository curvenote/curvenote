/* eslint-disable import/no-extraneous-dependencies */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createReturningVersion,
  createSubmissionVersion,
  dbAttachMetadataToWorkVersions,
  dbGetCheckServiceRunsByWorkVersionIds,
  dbGetLinkedJobsByWorkVersionIds,
  dbGetWorkActivities,
  dbGetWorkOwnerName,
  dbGetWorkUsers,
  findFirstSubmission,
  findFirstWorkVersion,
  findManySites,
  findUniqueSite,
  loadCheckMaintenanceByServiceIds,
  userHasScope,
  withSecureWorkContext,
} = vi.hoisted(() => ({
  createReturningVersion: vi.fn(),
  createSubmissionVersion: vi.fn(),
  dbAttachMetadataToWorkVersions: vi.fn(),
  dbGetCheckServiceRunsByWorkVersionIds: vi.fn(),
  dbGetLinkedJobsByWorkVersionIds: vi.fn(),
  dbGetWorkActivities: vi.fn(),
  dbGetWorkOwnerName: vi.fn(),
  dbGetWorkUsers: vi.fn(),
  findFirstSubmission: vi.fn(),
  findFirstWorkVersion: vi.fn(),
  findManySites: vi.fn(),
  findUniqueSite: vi.fn(),
  loadCheckMaintenanceByServiceIds: vi.fn(),
  userHasScope: vi.fn(),
  withSecureWorkContext: vi.fn(),
}));

vi.mock('@curvenote/scms-server', () => ({
  withSecureWorkContext,
  dbCreateDraftWorkVersion: vi.fn(),
  metadataForNewDraftFileWorkVersion: vi.fn(),
  userHasScope,
  getPrismaClient: vi.fn(async () => ({
    site: {
      findMany: findManySites,
      findUnique: findUniqueSite,
    },
    submission: {
      findFirst: findFirstSubmission,
    },
    workVersion: {
      findFirst: findFirstWorkVersion,
    },
  })),
  SiteContextWithUser: vi.fn(function SiteContextWithUser(ctx, site) {
    return { ...ctx, site };
  }),
  sites: {
    submissions: {
      createReturningVersion,
      versions: {
        create: createSubmissionVersion,
      },
    },
  },
  works: {
    formatWorkDTO: vi.fn((_ctx, _work, version) => ({
      id: 'work-1',
      title: version.title,
      links: {},
    })),
  },
}));

vi.mock('@curvenote/scms-core', () => ({
  MainWrapper: vi.fn(),
  SecondaryNav: vi.fn(),
  getBrandingFromMetaMatches: vi.fn(() => ({ title: 'SCMS' })),
  joinPageTitle: vi.fn((title: string | undefined, suffix: string) => `${title ?? ''} ${suffix}`),
  TrackEvent: {
    WORK_VIEWED: 'WORK_VIEWED',
  },
  getWorkflows: vi.fn(() => ({ SIMPLE: {} })),
  registerExtensionWorkflows: vi.fn(() => ({})),
  getExtensionCheckServicesFromServerConfig: vi.fn(() => []),
  loadCheckMaintenanceByServiceIds,
  CheckMaintenanceProvider: vi.fn(({ children }) => children),
  scopes: {
    app: {
      works: {
        upload: 'app:works:upload',
        submitToSite: 'app:works:submit-to-site',
      },
    },
    site: {
      submissions: {
        create: 'site:submissions:create',
      },
    },
    work: {
      id: {
        read: 'work:id:read',
      },
    },
  },
}));

vi.mock('./menu', () => ({
  buildMenu: vi.fn(() => []),
}));

vi.mock('./db.server', () => ({
  dbAttachMetadataToWorkVersions,
  dbGetCheckServiceRunsByWorkVersionIds,
  dbGetLinkedJobsByWorkVersionIds,
  dbGetLatestWorkVersionForWork: vi.fn(),
  dbGetWorkActivities,
  dbGetWorkOwnerName,
  dbGetWorkVersionsWithSubmissionVersions: vi.fn(async () => [
    {
      id: 'wv-1',
      title: 'Version 1',
      draft: false,
      date_created: '2026-01-01T00:00:00.000Z',
      date_modified: '2026-01-01T00:00:00.000Z',
      authors: [],
      author_details: [],
      submissionVersions: [],
    },
  ]),
  dbDeleteDraftVersionOnWork: vi.fn(),
}));

vi.mock('../works.$workId.users/db.server', () => ({
  dbGetWorkUsers,
  dtoWorkUsers: vi.fn(() => []),
}));

vi.mock('./WorkDetailsCard', () => ({
  WorkDetailsCard: vi.fn(),
}));

vi.mock('./utils.server', () => ({
  getUniqueSubmissions: vi.fn(() => []),
}));

vi.mock('./metadata.server', () => ({
  computeCanResumeDraftUpload: vi.fn(() => false),
  getLicenseDisplayFromMetadata: vi.fn(() => null),
  isDraftVersionValidForReuse: vi.fn(() => false),
  resolveWorkVersionDoi: vi.fn((versionDoi: string | null | undefined) => versionDoi ?? null),
  signVersionFilesForClient: vi.fn(async () => undefined),
}));

vi.mock('../../../extensions/client', () => ({
  extensions: [],
}));

vi.mock('../../../extensions/server', () => ({
  extensions: [],
}));

vi.mock('./actionHelpers.server', () => ({
  exportToPdfAction: vi.fn(),
}));

const { action, loader } = await import('./route');

function createSubmitToSiteRequest(siteName = 'private-site', workVersionId = 'wv-1'): Request {
  const formData = new FormData();
  formData.set('intent', 'submit-to-site');
  formData.set('siteName', siteName);
  formData.set('workVersionId', workVersionId);
  return new Request('http://localhost/app/works/work-1', {
    method: 'POST',
    body: formData,
  });
}

describe('work submit-to-site route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withSecureWorkContext.mockResolvedValue({
      user: {
        id: 'user-1',
        system_scopes: ['app:works:submit-to-site'],
        site_roles: [],
      },
      work: { id: 'work-1' },
      workDTO: { title: 'Work 1' },
      $config: {},
      trackEvent: vi.fn(),
      analytics: { flush: vi.fn() },
    });
    userHasScope.mockImplementation((_user, scope, siteName) => {
      if (scope === 'app:works:submit-to-site') return true;
      return scope === 'site:submissions:create' && siteName === 'allowed-site';
    });
    findUniqueSite.mockResolvedValue({
      id: 'site-private',
      name: 'private-site',
      title: 'Private Site',
      private: true,
      restricted: false,
      external: false,
      domains: [],
      submissionKinds: [{ id: 'kind-1', default: true }],
      collections: [
        {
          id: 'collection-1',
          default: true,
          open: true,
          kindsInCollection: [{ kind: { id: 'kind-1', default: true } }],
        },
      ],
    });
    findFirstSubmission.mockResolvedValue(null);
    findFirstWorkVersion.mockResolvedValue({ id: 'wv-1' });
    createReturningVersion.mockResolvedValue({ id: 'sv-1' });
    createSubmissionVersion.mockResolvedValue({ id: 'sv-2' });
    dbAttachMetadataToWorkVersions.mockImplementation(async (versions) => versions);
    dbGetWorkOwnerName.mockResolvedValue('Owner');
    dbGetWorkActivities.mockResolvedValue([]);
    dbGetCheckServiceRunsByWorkVersionIds.mockResolvedValue({});
    dbGetLinkedJobsByWorkVersionIds.mockResolvedValue({});
    dbGetWorkUsers.mockResolvedValue([]);
    loadCheckMaintenanceByServiceIds.mockResolvedValue({});
  });

  it('rejects private site submissions when the user lacks site create scope', async () => {
    const response = await action({
      request: createSubmitToSiteRequest(),
      params: { workId: 'work-1' },
    } as never);
    const status = 'init' in response ? response.init?.status : 200;
    const body = 'data' in response ? response.data : response;

    expect(status).toBe(403);
    expect(body).toMatchObject({
      success: false,
      intent: 'submit-to-site',
    });
    expect(createReturningVersion).not.toHaveBeenCalled();
  });

  it('allows submissions to public external sites', async () => {
    findUniqueSite.mockResolvedValue({
      id: 'site-external',
      name: 'external-site',
      title: 'External Site',
      private: false,
      restricted: false,
      external: true,
      domains: [],
      submissionKinds: [{ id: 'kind-1', default: true }],
      collections: [
        {
          id: 'collection-1',
          default: true,
          open: true,
          kindsInCollection: [{ kind: { id: 'kind-1', default: true } }],
        },
      ],
    });

    const response = await action({
      request: createSubmitToSiteRequest('external-site'),
      params: { workId: 'work-1' },
    } as never);

    const body = 'data' in response ? response.data : response;

    expect(body).toMatchObject({
      success: true,
      intent: 'submit-to-site',
      siteName: 'external-site',
      submissionVersionId: 'sv-1',
    });
    expect(createReturningVersion).toHaveBeenCalled();
  });

  it('exposes external sites first when the user can submit to them', async () => {
    findManySites.mockResolvedValue([
      {
        id: 'site-external',
        name: 'external-site',
        title: 'External Site',
        description: null,
        metadata: { logo: 'external.png' },
        external: true,
        private: false,
        restricted: false,
      },
      {
        id: 'site-public',
        name: 'public-site',
        title: 'Public Site',
        description: null,
        metadata: { logo: 'public.png' },
        external: false,
        private: false,
        restricted: false,
      },
      {
        id: 'site-private',
        name: 'private-site',
        title: 'Private Site',
        description: null,
        metadata: { logo: 'private.png' },
        external: false,
        private: true,
        restricted: false,
      },
      {
        id: 'site-allowed',
        name: 'allowed-site',
        title: 'Allowed Site',
        description: null,
        metadata: { logo: 'allowed.png' },
        external: false,
        private: true,
        restricted: false,
      },
    ]);

    const result = await loader({
      request: new Request('http://localhost/app/works/work-1/details'),
      params: { workId: 'work-1' },
    } as never);

    expect(findManySites).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ external: 'desc' }, { title: 'asc' }, { name: 'asc' }],
      }),
    );
    expect(result.availableSites.map((site) => site.name)).toEqual([
      'external-site',
      'public-site',
      'allowed-site',
    ]);
    expect(result.availableSites[0]).not.toHaveProperty('private');
    expect(result.availableSites[0]).not.toHaveProperty('restricted');
  });

  it('returns the existing submission version when the selected version is already submitted', async () => {
    findUniqueSite.mockResolvedValue({
      id: 'site-public',
      name: 'public-site',
      title: 'Public Site',
      private: false,
      restricted: false,
      external: false,
      domains: [],
      submissionKinds: [{ id: 'kind-1', default: true }],
      collections: [
        {
          id: 'collection-1',
          default: true,
          open: true,
          kindsInCollection: [{ kind: { id: 'kind-1', default: true } }],
        },
      ],
    });
    findFirstSubmission.mockResolvedValue({
      id: 'submission-1',
      versions: [{ id: 'sv-1', work_version_id: 'wv-1' }],
    });

    const response = await action({
      request: createSubmitToSiteRequest('public-site', 'wv-1'),
      params: { workId: 'work-1' },
    } as never);

    expect(response).toMatchObject({
      success: true,
      intent: 'submit-to-site',
      siteName: 'public-site',
      submissionVersionId: 'sv-1',
      alreadySubmitted: true,
    });
    expect(createSubmissionVersion).not.toHaveBeenCalled();
    expect(createReturningVersion).not.toHaveBeenCalled();
  });

  it('creates a new submission version when an already-submitted site receives a newer version', async () => {
    findUniqueSite.mockResolvedValue({
      id: 'site-public',
      name: 'public-site',
      title: 'Public Site',
      private: false,
      restricted: false,
      external: false,
      domains: [],
      submissionKinds: [{ id: 'kind-1', default: true }],
      collections: [
        {
          id: 'collection-1',
          default: true,
          open: true,
          kindsInCollection: [{ kind: { id: 'kind-1', default: true } }],
        },
      ],
    });
    findFirstSubmission.mockResolvedValue({
      id: 'submission-1',
      versions: [{ id: 'sv-1', work_version_id: 'wv-1' }],
    });
    findFirstWorkVersion.mockResolvedValue({ id: 'wv-2' });
    createSubmissionVersion.mockResolvedValue({ id: 'sv-2' });

    const response = await action({
      request: createSubmitToSiteRequest('public-site', 'wv-2'),
      params: { workId: 'work-1' },
    } as never);

    expect(response).toMatchObject({
      success: true,
      intent: 'submit-to-site',
      siteName: 'public-site',
      submissionVersionId: 'sv-2',
    });
    expect(createSubmissionVersion).toHaveBeenCalledWith(
      expect.objectContaining({ site: expect.objectContaining({ name: 'public-site' }) }),
      expect.any(Array),
      'submission-1',
      'wv-2',
    );
    expect(createReturningVersion).not.toHaveBeenCalled();
  });
});
