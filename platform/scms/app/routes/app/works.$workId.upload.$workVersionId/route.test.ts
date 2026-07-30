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
  enqueueAndDispatchJob,
  hasDocxInMetadata,
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
  enqueueAndDispatchJob: vi.fn(),
  hasDocxInMetadata: vi.fn(),
}));

vi.mock('@curvenote/scms-server', async () => ({
  withAppScopedContext: vi.fn(async () => ({
    user: { id: 'user-1' },
    $config: {},
    trackEvent: vi.fn(async () => undefined),
    analytics: { flush: vi.fn(async () => undefined) },
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
  enqueueAndDispatchJob,
  updateWorkVersionTitle: vi.fn(),
  updateWorkVersionAuthors: vi.fn(),
  updateWorkVersionAuthorMetadata: vi.fn(),
  toggleWorkVersionCheck: vi.fn(),
  shouldTrackWorkViewedOnLoader: vi.fn(),
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
  ExtensionChecksAnalyticsEventKey: {
    UPLOAD_CONFIRMED: 'upload_confirmed',
  },
  buildCheckServiceIdToExtensionMap: vi.fn(() => ({})),
  groupCheckServiceIdsByExtensionAnalyticsEvent: vi.fn(() => new Map()),
  scopes: {
    app: {
      works: {
        upload: 'app:works:upload',
        metadataExtract: 'app:works:metadataExtract',
        webArticleGeneration: 'app:works:web-article-generation',
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
  hasDocxInMetadata,
  MetadataExtractSection: vi.fn(),
  PREVIEW_BUSY_MESSAGES: [],
  useRotatingMessage: vi.fn(() => ''),
  ChooseThumbnailSection: vi.fn(),
  collectAllFigures: vi.fn(() => []),
  CaptureMetadataSection: vi.fn(),
  applyFiguresFetcherStateTransition: vi.fn(() => ({ wasInFlight: false, fetchFinished: false })),
  nextAutoFiguresAttempts: vi.fn((n: number) => n + 1),
  pendingFigurePathsKey: vi.fn(() => ''),
  shouldAutoSubmitFiguresFetch: vi.fn(() => false),
  shouldClearFiguresFetchFinishedForPendingKey: vi.fn(() => false),
  shouldManualRetryFigures: vi.fn(() => false),
  shouldResetFiguresAutoAttemptsForPendingKey: vi.fn(() => false),
  shouldShowFiguresRetry: vi.fn(() => false),
  buildThumbnailCandidateLocators: vi.fn((locs: string[]) => locs),
  encodeFigureLocator: vi.fn((key: string) => key),
  resolveThumbnailSelection: vi.fn(() => null),
  mystFrontmatterToAuthorField: vi.fn(() => ({ authors: [], affiliations: [] })),
  computeManuscriptSourceSignature: vi.fn(() => ''),
  UPLOAD_ANALYSIS_METADATA_KEY: 'upload.analysis',
  uploadFactPresenceFromValue: vi.fn(),
  clearUploadAnalysisMetadataFacts: vi.fn(),
  resolveUploadCheckLogoUrls: vi.fn(async () => ({})),
}));

vi.mock('@vercel/functions', () => ({
  waitUntil,
}));

vi.mock('@curvenote/scms-doc-preview', () => ({
  handleFetchPreviewsIntent: vi.fn(),
  handleFetchPreviewFiguresIntent: vi.fn(),
  deletePreviewArtifactsForVersion: vi.fn(async () => undefined),
  persistThumbnailListingForVersion: vi.fn(async () => undefined),
  signPreviewFigures: vi.fn(),
  readDocumentPreviewsFromObjectTable: vi.fn(),
  resolvePreviewImagePresence: vi.fn(),
  extractMetadataFromPreviews: vi.fn(),
  materializeSelectedThumbnail: vi.fn(),
  summarizePreviewCandidateFiles: vi.fn(() => ({ previewCandidateCount: 0, fileTypes: [] })),
  sanitizeUploadFlowFailureReason: vi.fn((m: string) => m),
  normalizeUploadFlowTrigger: vi.fn(() => 'auto'),
  resolveMetadataExtractionTrigger: vi.fn(() => 'auto'),
  trackDocumentPreviewStarted: vi.fn(),
  trackDocumentPreviewAnalytics: vi.fn(),
  trackMetadataExtractionStarted: vi.fn(),
  trackMetadataExtractionAnalytics: vi.fn(),
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
    hasDocxInMetadata.mockReturnValue(false);
    enqueueAndDispatchJob.mockResolvedValue({ job_id: 'job-1' });
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

  it('enqueues web converter only when docx is present and user has web-article-generation scope', async () => {
    const backgroundWork: Promise<unknown>[] = [];
    waitUntil.mockImplementation((promise: Promise<unknown>) => {
      backgroundWork.push(promise);
    });
    userHasWorkScope.mockReturnValue(true);
    hasDocxInMetadata.mockReturnValue(true);
    userHasScope.mockImplementation(
      (_user: unknown, scope: string) => scope === 'app:works:web-article-generation',
    );
    findUnique.mockResolvedValue({
      id: 'wv-1',
      cdn: 'cdn-1',
      metadata: { checks: { enabled: [] } },
    });
    update.mockResolvedValue({
      id: 'wv-1',
      cdn: 'cdn-1',
      metadata: { checks: { enabled: [] } },
    });

    const response = await action({
      request: createConfirmWorkRequest(),
      params: { workId: 'work-1', workVersionId: 'wv-1' },
    } as never);
    await Promise.all(backgroundWork);

    expect(response).toMatchObject({ data: { success: true } });
    expect(enqueueAndDispatchJob).toHaveBeenCalledWith(
      expect.objectContaining({
        job_type: 'CONVERTER_TASK',
        payload: expect.objectContaining({
          work_version_id: 'wv-1',
          target: 'web',
          conversion_type: 'docx-pd-curvenote-web',
        }),
      }),
    );
  });

  it('does not enqueue web converter without web-article-generation scope', async () => {
    const backgroundWork: Promise<unknown>[] = [];
    waitUntil.mockImplementation((promise: Promise<unknown>) => {
      backgroundWork.push(promise);
    });
    userHasWorkScope.mockReturnValue(true);
    hasDocxInMetadata.mockReturnValue(true);
    userHasScope.mockReturnValue(false);
    findUnique.mockResolvedValue({
      id: 'wv-1',
      cdn: 'cdn-1',
      metadata: { checks: { enabled: [] } },
    });
    update.mockResolvedValue({
      id: 'wv-1',
      cdn: 'cdn-1',
      metadata: { checks: { enabled: [] } },
    });

    await action({
      request: createConfirmWorkRequest(),
      params: { workId: 'work-1', workVersionId: 'wv-1' },
    } as never);
    await Promise.all(backgroundWork);

    expect(enqueueAndDispatchJob).not.toHaveBeenCalled();
  });
});
