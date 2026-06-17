import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Route } from './+types/route';
import type {
  WorkVersionCheckName,
  WorkVersionMetadata,
  ChecksMetadataSection,
} from '@curvenote/scms-server';
import {
  withAppScopedContext,
  userHasScope,
  findWorkByVersion,
  workVersionUploadsStage,
  workVersionUploadsComplete,
  workVersionUploadRemove,
  WorkContext,
  withValidFormData,
  getPrismaClient,
  safeWorkVersionJsonUpdate,
  signFilesInMetadata,
  workVersionCheckNameSchema,
  ChecksMetadataSchema,
  makeDefaultWorkVersionMetadata,
} from '@curvenote/scms-server';
import type { Prisma } from '@curvenote/scms-db';
import type { ExtensionCheckHandleActionArgs, FileMetadataSection } from '@curvenote/scms-core';
import {
  MainWrapper,
  PageFrame,
  SectionWithHeading,
  WorkFileUpload,
  TrackEvent,
  ui,
  FileMetadataSectionSchema,
  useDeploymentConfig,
  getExtensionCheckServicesFromClientConfig,
  getExtensionCheckServicesFromServerConfig,
  hasInvalidEnabledUploadChecks,
  loadCheckMaintenanceByServiceIds,
  CheckMaintenanceProvider,
  capitalize,
  scopes,
} from '@curvenote/scms-core';
import { extensions } from '../../../extensions/client';
import { extensions as serverExtensions } from '../../../extensions/server';
import { WorkUploadChecksForm } from './WorkUploadChecksForm';
import { getTextIntegrityLogoUrlFromObjectStore } from './textIntegrityLogo.server';
import { ContinueForm } from './ContinueForm';
import { WORK_UPLOAD_CONFIGURATION } from './uploadConfig.server';
import { validateUploadParams } from './validateUpload.server';
import { updateWorkVersionTitle, updateWorkVersionAuthors } from './updateMetadata.server';
import { toggleWorkVersionCheck } from './updateChecks.server';
import { shouldTrackWorkViewedOnLoader } from './loaderAnalytics.server.js';
import { data, redirect, useFetcher, useParams, useRevalidator } from 'react-router';
import { handleFetchPreviewsIntent } from './metadata-extract/fetchPreviews.server';
import {
  readDocxPreviewsFromObjectTable,
  type DocxPreviewItem,
} from './metadata-extract/fetchPreviews.server';
import { extractMetadataFromPreviews } from './metadata-extract/anthropic.server';
import type { ExtractedMetadata } from './metadata-extract/anthropic.server';
import { Upload, CheckSquare } from 'lucide-react';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { MetadataExtractSection } from './metadata-extract/MetadataExtractSection';
import { CaptureMetadataSection } from './CaptureMetadataSection';
import { isDocxPreviewCandidate } from './metadata-extract/docxPreviewGuards';
// eslint-disable-next-line import/no-extraneous-dependencies
import { waitUntil } from '@vercel/functions';

/**
 * Zod schema for work upload form validation
 */
const WorkUploadActionSchema = zfd.formData({
  intent: z.enum([
    'stage',
    'complete',
    'remove',
    'update-title',
    'update-authors',
    'toggle-check',
    'confirm-work',
    'fetch-previews',
    'extract-metadata',
  ]),
  slot: zfd.text(z.string().min(1)).optional(),
  // Optional fields used by specific intents
  completedFiles: zfd.text(z.string()).optional(), // Used by 'complete' intent
  path: zfd.text(z.string()).optional(), // Used by 'remove' intent
  title: zfd.text(z.string().default('')), // Used by 'update-title' intent - allows empty strings
  authors: zfd.text(z.string()).optional(), // Used by 'confirm-work' intent
  redirect: zfd.text(z.enum(['true', 'false'])).optional(), // Used by 'confirm-work' intent; default true
  checkName: zfd.text(workVersionCheckNameSchema).optional(), // Used by 'toggle-check' intent
  checked: zfd.text(z.enum(['true', 'false'])).optional(), // Used by 'toggle-check' intent
});

type WorkUploadActionPayload = z.infer<typeof WorkUploadActionSchema>;

/** Article title from an uploaded file name (path segments stripped, extension removed). */
function titleFromUploadedFileName(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, '');
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return base.trim();
  return base.slice(0, dot).trim();
}

function parseAuthorsList(authorsText: string): string[] {
  return authorsText
    .split(',')
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

// NOTE: Check service run schema is now defined and managed by each check
// extension when they create checkServiceRun rows.

async function dispatchEnabledChecksAfterUpload({
  enabledChecks,
  workVersionId,
  ctx,
}: {
  enabledChecks: WorkVersionCheckName[];
  workVersionId: string;
  ctx: NonNullable<ExtensionCheckHandleActionArgs['ctx']>;
}) {
  const checkServices = getExtensionCheckServicesFromServerConfig(ctx.$config, serverExtensions);
  const results = await Promise.allSettled(
    enabledChecks.map(async (kind) => {
      const service = checkServices.find((s) => s.id === kind);
      if (!service?.handleAction) {
        console.warn(`[work-upload] no check service handleAction found for kind=${kind}`);
        return;
      }
      const actionArgs: ExtensionCheckHandleActionArgs = {
        intent: 'execute',
        workVersionId,
        ctx,
        serverExtensions,
      };
      const { success, error, status } = await service.handleAction(actionArgs);
      if (!success || error) {
        throw new Error(
          `[work-upload] check dispatch failed for kind=${kind} status=${status ?? 'unknown'}: ${
            error?.message ?? 'Check execution failed'
          }`,
        );
      }
      // Check-start activities are created when jobs are invoked (invoke.server.ts),
      // including for follow-on jobs, so we do not create them here.
    }),
  );
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length > 0) {
    failures.forEach((failure) => {
      console.error('[work-upload] background check dispatch failed', failure.reason);
    });
    throw new Error(
      `[work-upload] ${failures.length} check dispatch${
        failures.length === 1 ? '' : 'es'
      } failed; see prior logs for details`,
    );
  }
}

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppScopedContext(args, [scopes.app.works.upload], { redirect: true });
  const { workId, workVersionId } = args.params;

  if (!workId || !workVersionId) {
    throw redirect('/app/works');
  }

  // Get the work version
  const work = await findWorkByVersion(workVersionId);

  if (!work || work.id !== workId) {
    throw redirect('/app/works');
  }

  // Authors: use work version's authors only; no default from current user
  const authorsText = work.authors?.length ? work.authors.join(', ') : '';

  if (shouldTrackWorkViewedOnLoader(args.request)) {
    await ctx.trackEvent(TrackEvent.WORK_VIEWED, {
      workId: work.id,
      workVersionId: work.version_id,
      isDraft: work.draft,
      source: 'work-version-upload',
    });
  }

  // Extract and validate metadata structure
  const rawMetadata = work.metadata || {};

  // Validate and extract file metadata section
  const fileMetadataResult = FileMetadataSectionSchema.safeParse(rawMetadata);
  const fileMetadata: FileMetadataSection = fileMetadataResult.success
    ? fileMetadataResult.data
    : { files: {} };

  // Validate and extract checks metadata section
  const checksResult = ChecksMetadataSchema.safeParse(rawMetadata);
  const checks =
    checksResult.success && checksResult.data.checks ? checksResult.data.checks : { enabled: [] };

  // Construct properly typed metadata
  const metadata: WorkVersionMetadata & FileMetadataSection & ChecksMetadataSection = {
    ...makeDefaultWorkVersionMetadata(),
    ...(rawMetadata as Record<string, any>),
    ...fileMetadata,
    ...checks,
  };

  const signedMetadata = await signFilesInMetadata(metadata, work.cdn ?? '', ctx);

  // Customise title/subtitle by where the user arrived from (from= search param)
  const from = new URL(args.request.url).searchParams.get('from') ?? '';
  const stringReplacements = ctx.getStringReplacements();
  const workLabel = stringReplacements.work;
  const workTitle = capitalize(workLabel);
  const pageCopy: { title: string; subtitle: string } = (() => {
    switch (from) {
      case 'new':
        return {
          title: `Upload a New ${workTitle}`,
          subtitle: `Start a new ${workLabel} by uploading your files`,
        };
      case 'details':
        return {
          title: 'Upload a New Version',
          subtitle: `Add a new version of this ${workLabel} by uploading your files`,
        };
      case 'drafts':
        return {
          title: 'Resume Upload',
          subtitle: 'Continue uploading and complete your draft',
        };
      default:
        return {
          title: `Upload a New ${workTitle}`,
          subtitle: `Start a new ${workLabel} by uploading your files`,
        };
    }
  })();

  // Read only cached DOCX previews from Object table (no generation in loader)

  const previews = await readDocxPreviewsFromObjectTable(signedMetadata);
  // Stored under the same key as the ETL register-work endpoint: metadata["frontmatter.myst"].
  const mystFrontmatter = (rawMetadata as Record<string, unknown>)?.['frontmatter.myst'];
  const extractedMetadata: ExtractedMetadata | null =
    mystFrontmatter != null &&
    typeof mystFrontmatter === 'object' &&
    !Array.isArray(mystFrontmatter)
      ? (mystFrontmatter as ExtractedMetadata)
      : null;

  const hasMetadataExtractScope = userHasScope(
    ctx.user,
    scopes.app.works.metadataExtract,
    undefined,
    { ignoreSystemAdmin: true },
  );

  const textIntegrityLogoUrl = await getTextIntegrityLogoUrlFromObjectStore();

  const uploadCheckServices = getExtensionCheckServicesFromServerConfig(
    ctx.$config,
    serverExtensions,
  );
  const maintenanceByServiceId = await loadCheckMaintenanceByServiceIds(
    ctx,
    serverExtensions,
    uploadCheckServices.map((service) => service.id),
  );

  return {
    workVersionId: work.version_id,
    cdnKey: work.cdn_key!,
    cdn: work.cdn!,
    title: work.title,
    authors: authorsText,
    metadata: signedMetadata as any,
    uploadConfig: WORK_UPLOAD_CONFIGURATION,
    pageTitle: pageCopy.title,
    pageSubtitle: pageCopy.subtitle,
    stringReplacements,
    previews,
    extractedMetadata,
    hasMetadataExtractScope,
    textIntegrityLogoUrl,
    maintenanceByServiceId,
  };
}

export async function action(args: Route.ActionArgs) {
  const baseCtx = await withAppScopedContext(args, [scopes.app.works.upload]);
  const formData = await args.request.formData();
  const { workId, workVersionId } = args.params;

  if (!workId || !workVersionId) {
    return data(
      { error: { type: 'general', message: 'Work ID and version ID are required' } },
      { status: 400 },
    );
  }

  try {
    const payload = WorkUploadActionSchema.parse(formData);
    console.log('payload', payload);
  } catch {
    return data({ error: { type: 'general', message: 'Invalid form data' } }, { status: 400 });
  }

  // Handle upload intents (stage, complete, remove, update-title, toggle-check) with validation
  return withValidFormData(
    WorkUploadActionSchema,
    formData,
    async (payload: WorkUploadActionPayload) => {
      const {
        intent: uploadIntent,
        slot,
        title,
        authors,
        redirect: redirectParam,
        checkName,
        checked,
      } = payload;

      // Handle title update intent (updates title field)
      if (uploadIntent === 'update-title') {
        if (!workVersionId) {
          return data(
            { error: { type: 'general', message: 'Work version ID is required' } },
            { status: 400 },
          );
        }

        // Explicitly handle title - use empty string if undefined
        const titleValue = title !== undefined ? title : '';
        console.log('updateWorkVersionTitle', workVersionId, 'title:', titleValue);
        return updateWorkVersionTitle(workVersionId, titleValue);
      }

      // Handle authors update intent (updates work version authors array)
      if (uploadIntent === 'update-authors') {
        if (!workVersionId) {
          return data(
            { error: { type: 'general', message: 'Work version ID is required' } },
            { status: 400 },
          );
        }
        const authorsValue = authors ?? '';
        return updateWorkVersionAuthors(workVersionId, authorsValue);
      }

      // Handle check toggle intent (toggles a single check in metadata)
      if (uploadIntent === 'toggle-check') {
        if (!workVersionId) {
          return data(
            { error: { type: 'general', message: 'Work version ID is required' } },
            { status: 400 },
          );
        }

        if (!checkName) {
          return data(
            { error: { type: 'general', message: 'Check name is required' } },
            { status: 400 },
          );
        }

        const isChecked = checked === 'true';

        if (isChecked) {
          const maintenanceByServiceId = await loadCheckMaintenanceByServiceIds(
            baseCtx,
            serverExtensions,
            [checkName],
          );
          const maintenance = maintenanceByServiceId[checkName];
          if (maintenance?.underMaintenance) {
            return data(
              {
                error: {
                  type: 'maintenance',
                  message: maintenance.message,
                },
              },
              { status: 503 },
            );
          }
        }

        return toggleWorkVersionCheck(workVersionId, checkName, isChecked);
      }

      // Handle confirm-work intent - confirm work and initialize checks
      if (uploadIntent === 'confirm-work') {
        if (!workVersionId) {
          return data(
            { error: { type: 'general', message: 'Work version ID is required' } },
            { status: 400 },
          );
        }

        const prisma = await getPrismaClient();
        const timestamp = new Date().toISOString();

        const authorsText = (authors ?? '').trim();
        const authorsList = authorsText ? parseAuthorsList(authorsText) : [];

        // Get current metadata to access enabled checks
        let wv = await prisma.workVersion.findUnique({
          where: { id: workVersionId },
        });

        const currentMetadata = (wv?.metadata as any) || makeDefaultWorkVersionMetadata();
        const enabledChecks = (currentMetadata.checks?.enabled as WorkVersionCheckName[]) || [];

        const uploadCheckServices = getExtensionCheckServicesFromServerConfig(
          baseCtx.$config,
          serverExtensions,
        );

        // Checks whose service is under maintenance are not initiated. The work is
        // created as though those checks were never selected; they can be run later
        // once the service is back online.
        const maintenanceByServiceId = await loadCheckMaintenanceByServiceIds(
          baseCtx,
          serverExtensions,
          enabledChecks,
        );
        const dispatchableChecks = enabledChecks.filter(
          (name) => !maintenanceByServiceId[name]?.underMaintenance,
        );

        if (
          hasInvalidEnabledUploadChecks(currentMetadata, dispatchableChecks, uploadCheckServices)
        ) {
          return data(
            {
              error: {
                type: 'validation',
                message:
                  'One or more selected checks are not compatible with your uploaded files. Deselect them or adjust your uploads before continuing.',
              },
            },
            { status: 400 },
          );
        }

        // Create check status objects for each dispatchable check
        const checkStatuses: Record<string, any> = {};
        dispatchableChecks.forEach((name) => {
          checkStatuses[name] = {};
        });

        // Update metadata with check statuses (maintenance checks are dropped)
        await safeWorkVersionJsonUpdate(workVersionId, (metadata?: Prisma.JsonValue) => {
          const meta = (metadata as Record<string, any>) || makeDefaultWorkVersionMetadata();
          return {
            ...meta,
            checks: {
              enabled: dispatchableChecks,
              ...checkStatuses,
            },
          } as Prisma.JsonObject;
        });

        // Flip the work out of draft mode
        wv = await prisma.workVersion.update({
          where: { id: workVersionId },
          data: {
            draft: false,
            date_modified: timestamp,
            ...(authorsList.length > 0 ? { authors: authorsList } : {}),
          },
        });

        // Schedule each enabled check via its extension. Each check service is
        // responsible for creating its own checkServiceRun rows and jobs.
        // Require work:checks:dispatch scope before dispatching (same as work-integrity action).
        if (dispatchableChecks.length > 0) {
          if (!userHasScope(baseCtx.user, scopes.app.works.checks.dispatch)) {
            return data(
              {
                error: {
                  type: 'general',
                  message: 'You do not have permission to dispatch checks for this work',
                },
              },
              { status: 403 },
            );
          }
          waitUntil(
            dispatchEnabledChecksAfterUpload({
              enabledChecks: dispatchableChecks,
              workVersionId,
              ctx: baseCtx,
            }).catch((error) => {
              console.error('[work-upload] background check dispatch failed', {
                workId,
                workVersionId,
                enabledChecks: dispatchableChecks,
                error,
              });
            }),
          );
        }

        // Redirect unless redirect=false (e.g. when called from manuscript-checks dialog).
        // If at least one check was selected during upload, redirect to /checks so the
        // user can see check progress; otherwise redirect to /details.
        const shouldRedirect = redirectParam !== 'false';
        if (shouldRedirect) {
          const target =
            dispatchableChecks.length > 0
              ? `/app/works/${workId}/checks?dispatching=1`
              : `/app/works/${workId}/details`;
          return redirect(target);
        }
        return data({ success: true });
      }

      // Fetch DOCX previews (generate + write to Object table only)
      if (uploadIntent === 'fetch-previews') {
        if (!workVersionId) {
          return data(
            { error: { type: 'general', message: 'Work version ID is required' } },
            { status: 400 },
          );
        }
        if (
          !userHasScope(baseCtx.user, scopes.app.works.metadataExtract, undefined, {
            ignoreSystemAdmin: true,
          })
        ) {
          return data(
            {
              error: {
                type: 'general',
                message: 'You do not have permission to generate document previews',
              },
            },
            { status: 403 },
          );
        }
        const { previews } = await handleFetchPreviewsIntent(workVersionId, baseCtx);
        return data({ ok: true, previewsGenerated: previews.length });
      }

      // Extract metadata from first DOCX via Claude (only when no frontmatter and we have previews)
      if (uploadIntent === 'extract-metadata') {
        if (!workVersionId) {
          return data(
            { error: { type: 'general', message: 'Work version ID is required' } },
            { status: 400 },
          );
        }
        if (
          !userHasScope(baseCtx.user, scopes.app.works.metadataExtract, undefined, {
            ignoreSystemAdmin: true,
          })
        ) {
          return data(
            {
              error: {
                type: 'general',
                message: 'You do not have permission to extract metadata from previews',
              },
            },
            { status: 403 },
          );
        }
        const work = await findWorkByVersion(workVersionId);
        if (!work) {
          return data(
            { error: { type: 'general', message: 'Work version not found' } },
            { status: 404 },
          );
        }
        const currentMeta = (work.metadata as Record<string, unknown>) ?? {};
        const hasMystFrontmatter = currentMeta['frontmatter.myst'] != null;
        if (hasMystFrontmatter) {
          return data({ ok: true });
        }
        const signedMetadata = await signFilesInMetadata(
          (work.metadata as Parameters<typeof signFilesInMetadata>[0]) ?? {},
          work.cdn ?? '',
          baseCtx,
        );
        const previews = await readDocxPreviewsFromObjectTable(signedMetadata);
        if (previews.length === 0) {
          return data({ ok: true });
        }
        try {
          const extracted = await extractMetadataFromPreviews({ previews }, baseCtx);
          if (extracted != null) {
            await safeWorkVersionJsonUpdate(workVersionId, (current?: Prisma.JsonValue) => {
              const m = (current as Record<string, unknown>) || {};
              // Align with the ETL register-work endpoint: store at metadata["frontmatter.myst"].
              return {
                ...m,
                'frontmatter.myst': extracted,
              } as Prisma.JsonObject;
            });
          }
          return data({ ok: true });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Failed to extract metadata from document';
          return data({ error: { type: 'general', message } }, { status: 500 });
        }
      }

      // For other intents, slot is required
      if (!slot) {
        return data(
          { error: { type: 'general', message: 'Slot is required for this intent' } },
          { status: 400 },
        );
      }

      // Validate upload parameters
      const validationResult = await validateUploadParams(workId, workVersionId, slot);

      // Check if validation returned an error
      if ('error' in validationResult) {
        return data({ error: validationResult.error }, { status: validationResult.status });
      }
      const { work, uploadConfig, cdn } = validationResult;

      // Create work context
      const ctx = new WorkContext(baseCtx, work);

      try {
        switch (uploadIntent) {
          case 'stage':
            return workVersionUploadsStage(ctx, uploadConfig, formData, workVersionId);
          case 'complete':
            return workVersionUploadsComplete(ctx, formData, workVersionId, cdn);
          case 'remove':
            return workVersionUploadRemove(ctx, formData, workVersionId, cdn);
          default:
            return data(
              { error: { type: 'general', message: `Invalid intent ${uploadIntent}` } },
              { status: 400 },
            );
        }
      } catch (error) {
        console.error('Upload action error:', error);
        return data(
          {
            error: {
              type: 'general',
              message: error instanceof Error ? error.message : 'Upload action failed',
            },
          },
          { status: 500 },
        );
      }
    },
  );
}

export default function WorksUpload({ loaderData }: Route.ComponentProps) {
  const {
    cdnKey,
    uploadConfig,
    metadata,
    title,
    authors,
    pageTitle,
    pageSubtitle,
    previews = [],
    extractedMetadata,
    maintenanceByServiceId,
    hasMetadataExtractScope,
  } = loaderData;
  const { workVersionId } = useParams();
  const previewList: DocxPreviewItem[] = Array.isArray(previews) ? previews : [];
  const revalidator = useRevalidator();
  const fetchPreviewsFetcher = useFetcher();
  const autoTitleFromFilenameFetcher = useFetcher();
  const hasTriggeredFetchPreviews = useRef(false);

  const suggestArticleTitleFromSelectedFiles = useCallback(
    (files: File[]) => {
      const first = files[0];
      if (!first?.name) return;

      const hasStoredTitle = Boolean(title?.trim());
      const hasExtractedTitle = Boolean(extractedMetadata?.title?.trim());
      if (hasStoredTitle || hasExtractedTitle) return;

      const suggested = titleFromUploadedFileName(first.name);
      if (!suggested) return;

      autoTitleFromFilenameFetcher.submit(
        { intent: 'update-title', title: suggested },
        { method: 'post' },
      );
    },
    [title, extractedMetadata, autoTitleFromFilenameFetcher.submit],
  );

  const deploymentConfig = useDeploymentConfig();
  const checkServices = useMemo(
    () => getExtensionCheckServicesFromClientConfig(deploymentConfig, extensions),
    [deploymentConfig],
  );

  const files = (metadata?.files ?? {}) as Record<
    string,
    { path?: string; name?: string; type?: string }
  >;
  const docxFilePaths = Object.entries(files)
    .filter(([, f]) => isDocxPreviewCandidate(f))
    .map(([path]) => path);
  const previewPaths = new Set(previewList.map((p) => p.path));
  const missingPreviewPaths = docxFilePaths.filter((p) => !previewPaths.has(p));
  const shouldFetchPreviews =
    hasMetadataExtractScope && docxFilePaths.length > 0 && missingPreviewPaths.length > 0;

  useEffect(() => {
    if (!shouldFetchPreviews) {
      hasTriggeredFetchPreviews.current = false;
      return;
    }
    if (hasTriggeredFetchPreviews.current || fetchPreviewsFetcher.state !== 'idle') return;
    hasTriggeredFetchPreviews.current = true;
    fetchPreviewsFetcher.submit({ intent: 'fetch-previews' }, { method: 'POST' });
  }, [shouldFetchPreviews, fetchPreviewsFetcher.state, fetchPreviewsFetcher]);

  // Show toast when fetch-previews action returns an error
  useEffect(() => {
    if (fetchPreviewsFetcher.state === 'idle' && fetchPreviewsFetcher.data?.error) {
      ui.toastError(fetchPreviewsFetcher.data.error.message);
    }
  }, [fetchPreviewsFetcher.state, fetchPreviewsFetcher.data]);

  const isGeneratingPreviews =
    fetchPreviewsFetcher.state === 'loading' || fetchPreviewsFetcher.state === 'submitting';
  const isPreviewsLoading = revalidator.state === 'loading' || isGeneratingPreviews;
  const previewOverlayMessage = isGeneratingPreviews
    ? 'Generating previews…'
    : 'Refreshing previews…';

  return (
    <CheckMaintenanceProvider maintenanceByServiceId={maintenanceByServiceId}>
      <MainWrapper>
        <PageFrame
          title={pageTitle}
          subtitle={pageSubtitle}
          hasSecondaryNav={false}
          className="space-y-16 max-w-none text-left"
        >
          <SectionWithHeading
            heading="Upload your manuscript"
            icon={<Upload className="w-5 h-5" />}
            className="space-y-4 max-w-3xl"
          >
            <p className="text-md text-muted-foreground">
              Upload one or more manuscript files (DOCX or PDF), up to 100 MB total. Individual
              check services may have stricter limits.
            </p>
            <WorkFileUpload
              cdnKey={cdnKey}
              config={uploadConfig['manuscript']}
              loadedFileMetadata={metadata as any}
              onFilesSelected={suggestArticleTitleFromSelectedFiles}
            />
          </SectionWithHeading>
          {hasMetadataExtractScope ? (
            <React.Suspense
              fallback={<p className="text-sm text-muted-foreground">Loading DOCX previews…</p>}
            >
              <MetadataExtractSection
                previewList={previewList}
                isPreviewsLoading={isPreviewsLoading}
                previewOverlayMessage={previewOverlayMessage}
                extractedMetadata={extractedMetadata}
                title={title}
                authors={authors}
              />
            </React.Suspense>
          ) : (
            <CaptureMetadataSection title={title} authors={authors} />
          )}
          <SectionWithHeading
            heading="Select Checks to Run"
            icon={<CheckSquare className="w-5 h-5" />}
            className="space-y-4 max-w-5xl"
          >
            <p className="text-muted-foreground">
              Choose which checks you'd like to run on your work.
            </p>
            <WorkUploadChecksForm
              enabled={metadata.checks?.enabled || []}
              checkServices={checkServices}
              workVersionId={workVersionId!}
              metadata={metadata}
              textIntegrityLogoUrl={loaderData.textIntegrityLogoUrl}
            />
          </SectionWithHeading>
          <ContinueForm
            title={title}
            authors={authors}
            metadata={metadata}
            checkServices={checkServices}
          />
        </PageFrame>
      </MainWrapper>
    </CheckMaintenanceProvider>
  );
}
