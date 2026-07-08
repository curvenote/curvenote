/* eslint-disable import/no-extraneous-dependencies */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const {
  findUnique,
  update,
  safeWorkVersionJsonUpdate,
  userHasScope,
  userHasWorkScope,
  dbGetUserWorkRoles,
  waitUntil,
  loadCheckMaintenanceByServiceIds,
  hasInvalidEnabledUploadChecks,
} = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  safeWorkVersionJsonUpdate: vi.fn(),
  userHasScope: vi.fn(),
  userHasWorkScope: vi.fn(),
  dbGetUserWorkRoles: vi.fn(),
  waitUntil: vi.fn(),
  loadCheckMaintenanceByServiceIds: vi.fn(),
  hasInvalidEnabledUploadChecks: vi.fn(),
}));

vi.mock('@curvenote/scms-server', async () => ({
  withAppScopedContext: vi.fn(async () => ({
    user: { id: 'user-1' },
    $config: {},
  })),
  userHasScope,
  userHasWorkScope,
  dbGetUserWorkRoles,
  findWorkByVersion: vi.fn(),
  workVersionUploadsStage: vi.fn(),
  workVersionUploadsComplete: vi.fn(),
  workVersionUploadRemove: vi.fn(),
  WorkContext: vi.fn(),
  withValidFormData: vi.fn(async (_schema, _formData, callback) =>
    callback({
      intent: 'confirm-work',
      redirect: 'false',
    }),
  ),
  getPrismaClient: vi.fn(async () => ({
    workVersion: {
      findUnique,
      update,
    },
  })),
  safeWorkVersionJsonUpdate,
  signFilesInMetadata: vi.fn(),
  workVersionCheckNameSchema: z.enum(['text-integrity']),
  ChecksMetadataSchema: z.object({}).passthrough(),
  makeDefaultWorkVersionMetadata: vi.fn(() => ({ checks: { enabled: [] } })),
  fetchOrcidPerson: vi.fn(),
  searchOrcid: vi.fn(),
  searchOrcidById: vi.fn(),
  searchRor: vi.fn(),
}));

vi.mock('@curvenote/scms-core', async () => ({
  MainWrapper: vi.fn(),
  PageFrame: vi.fn(),
  SectionWithHeading: vi.fn(),
  WorkFileUpload: vi.fn(),
  TrackEvent: vi.fn(),
  ui: {
    Button: vi.fn(),
    ConfirmDialog: vi.fn(),
    Loading: vi.fn(),
  },
  FileMetadataSectionSchema: z.object({}).passthrough(),
  useDeploymentConfig: vi.fn(),
  getExtensionCheckServicesFromClientConfig: vi.fn(() => []),
  getExtensionCheckServicesFromServerConfig: vi.fn(() => [{ id: 'text-integrity' }]),
  hasInvalidEnabledUploadChecks,
  loadCheckMaintenanceByServiceIds,
  CheckMaintenanceProvider: vi.fn(),
  capitalize: vi.fn((value: string) => value),
  MANUSCRIPT_UPLOAD_ACCEPT: '.pdf,.docx',
  MANUSCRIPT_UPLOAD_MIME_TYPES: ['application/pdf'],
  scopes: {
    app: {
    works: {
      upload: 'app:works:upload',
      metadataExtract: 'app:works:metadataExtract',
    },
  },
  work: {
    id: {
      checks: {
        dispatch: 'work:checks:dispatch',
      },
    },
  },
  },
  isValidOrcid: vi.fn(),
}));

vi.mock('@vercel/functions', () => ({
  waitUntil,
}));

vi.mock('./metadata-extract/fetchPreviews.server', () => ({
  handleFetchPreviewsIntent: vi.fn(),
  deletePreviewArtifactsForVersion: vi.fn(async () => undefined),
  persistThumbnailListingForVersion: vi.fn(async () => undefined),
  signPreviewFigures: vi.fn(),
  readDocumentPreviewsFromObjectTable: vi.fn(),
}));

vi.mock('./metadata-extract/materializeThumbnail.server', () => ({
  materializeSelectedThumbnail: vi.fn(),
}));

vi.mock('./metadata-extract/anthropic.server', () => ({
  extractMetadataFromPreviews: vi.fn(),
}));

vi.mock('./updateMetadata.server', () => ({
  updateWorkVersionTitle: vi.fn(),
  updateWorkVersionAuthors: vi.fn(),
  updateWorkVersionAuthorMetadata: vi.fn(),
}));

vi.mock('./updateChecks.server', () => ({
  toggleWorkVersionCheck: vi.fn(),
}));

vi.mock('./loaderAnalytics.server.js', () => ({
  shouldTrackWorkViewedOnLoader: vi.fn(),
}));

vi.mock('../../../extensions/client', () => ({
  extensions: [],
}));

vi.mock('../../../extensions/server', () => ({
  extensions: [],
}));

const { action } = await import('./route');

function createConfirmWorkRequest(): Request {
  const formData = new FormData();
  formData.set('intent', 'confirm-work');
  formData.set('redirect', 'false');
  return new Request('http://localhost/app/works/work-1/upload/wv-1', {
    method: 'POST',
    body: formData,
  });
}

describe('work upload confirm-work action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue({
      id: 'wv-1',
      cdn: 'cdn-1',
      metadata: {
        checks: {
          enabled: ['text-integrity'],
        },
      },
    });
    userHasScope.mockReturnValue(false);
    userHasWorkScope.mockReturnValue(false);
    dbGetUserWorkRoles.mockResolvedValue([]);
    loadCheckMaintenanceByServiceIds.mockResolvedValue({});
    hasInvalidEnabledUploadChecks.mockReturnValue(false);
    safeWorkVersionJsonUpdate.mockResolvedValue(undefined);
    update.mockResolvedValue({
      id: 'wv-1',
      cdn: 'cdn-1',
    });
  });

  it('does not confirm or mutate the work version when check dispatch permission is missing', async () => {
    const response = await action({
      request: createConfirmWorkRequest(),
      params: { workId: 'work-1', workVersionId: 'wv-1' },
    } as never);

    expect(response).toMatchObject({
      init: { status: 403 },
      data: {
        error: {
          message: 'You do not have permission to dispatch checks for this work',
        },
      },
    });
    expect(safeWorkVersionJsonUpdate).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(waitUntil).not.toHaveBeenCalled();
  });
});
