import React, { useEffect, useRef } from 'react';
import type { Route } from './+types/route';
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
} from '@curvenote/scms-server';
import type { Prisma } from '@curvenote/scms-db';
import type {
  ExtensionCheckService,
  ExtensionCheckHandleActionArgs,
  FileMetadataSection,
} from '@curvenote/scms-core';
import {
  MainWrapper,
  PageFrame,
  SectionWithHeading,
  WorkFileUpload,
  TrackEvent,
  ui,
  FileMetadataSectionSchema,
  scopes,
  useDeploymentConfig,
  getExtensionCheckServicesFromClientConfig,
  getExtensionCheckServicesFromServerConfig,
} from '@curvenote/scms-core';
import { extensions } from '../../../extensions/client';
import { extensions as serverExtensions } from '../../../extensions/server';
import { WorkUploadChecksForm } from './WorkUploadChecksForm';
import { ContinueForm } from './ContinueForm';
import { WORK_UPLOAD_CONFIGURATION } from './uploadConfig.server';
import { validateUploadParams } from './validateUpload.server';
import { updateWorkVersionTitle, updateWorkVersionAuthors } from './updateMetadata.server';
import { toggleWorkVersionCheck } from './updateChecks.server';
import {
  handleFetchPreviewsIntent,
  readDocxPreviewsFromObjectTable,
  type DocxPreviewItem,
} from './fetchPreviews.server';
import { extractMetadataFromPreviews } from './anthropic.server';
import type { ChecksMetadataSection } from './checks.schema';
import type { ExtractedMetadata } from './anthropic.server';
import { workVersionCheckNameSchema, checksMetadataSchema } from './checks.schema';
import type { WorkVersionCheckName, WorkVersionMetadata } from '@curvenote/scms-server';
import { data, redirect, useFetcher, useRevalidator } from 'react-router';
import { Upload, CheckSquare } from 'lucide-react';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { MetadataPreviewSection } from './MetadataPreviewSection';
import { CaptureMetadataSection } from './CaptureMetadataSection';

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

function parseAuthorsList(authorsText: string): string[] {
  return authorsText
    .split(',')
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

// NOTE: Check service run schema is now defined and managed by each check
// extension when they create checkServiceRun rows.

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppScopedContext(args, [scopes.app.works.upload]);
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

  // Track view
  await ctx.trackEvent(TrackEvent.WORK_VIEWED, {
    workId: work.id,
    workVersionId: work.version_id,
    isDraft: work.draft,
    source: 'work-version-upload',
  });

  // Extract and validate metadata structure
  const rawMetadata = work.metadata || {};

  // Validate and extract file metadata section
  const fileMetadataResult = FileMetadataSectionSchema.safeParse(rawMetadata);
  const fileMetadata: FileMetadataSection = fileMetadataResult.success
    ? fileMetadataResult.data
    : { files: {} };

  // Validate and extract checks metadata section
  const checksResult = checksMetadataSchema.safeParse(rawMetadata);
  const checks =
    checksResult.success && checksResult.data.checks ? checksResult.data.checks : { enabled: [] };

  // Construct properly typed metadata
  const metadata: WorkVersionMetadata & FileMetadataSection & ChecksMetadataSection = {
    version: 1,
    ...(rawMetadata as Record<string, any>),
    ...fileMetadata,
    ...checks,
  };

  const signedMetadata = await signFilesInMetadata(metadata, work.cdn ?? '', ctx);

  // Customise title/subtitle by where the user arrived from (from= search param)
  const from = new URL(args.request.url).searchParams.get('from') ?? '';
  const pageCopy: { title: string; subtitle: string } = (() => {
    switch (from) {
      case 'new':
        return {
          title: 'Upload a New Work',
          subtitle: 'Start a new work by uploading your files',
        };
      case 'details':
        return {
          title: 'Upload a New Version',
          subtitle: 'Add a new version of this work by uploading your files',
        };
      case 'drafts':
        return {
          title: 'Resume Upload',
          subtitle: 'Continue uploading and complete your draft',
        };
      default:
        return {
          title: 'Upload a New Work',
          subtitle: 'Start a new work by uploading your files',
        };
    }
  })();

  // Read only cached DOCX previews from Object table (no generation in loader)

  const previews = await readDocxPreviewsFromObjectTable(signedMetadata);
  const myst = (rawMetadata as Record<string, unknown>)?.myst;
  const extractedMetadata: ExtractedMetadata | null =
    myst != null && typeof myst === 'object' && 'frontmatter' in myst
      ? ((myst as { frontmatter: ExtractedMetadata }).frontmatter as ExtractedMetadata)
      : null;

  const hasMetadataPreviewScope = userHasScope(
    ctx.user,
    scopes.app.works.metadataPreview,
    undefined,
    { ignoreSystemAdmin: true },
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
    previews,
    extractedMetadata,
    hasMetadataPreviewScope,
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
  } catch (error) {
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
        console.log('toggleWorkVersionCheck', workVersionId, checkName, checked);
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

        const currentMetadata = (wv?.metadata as any) || { version: 1 };
        const enabledChecks = (currentMetadata.checks?.enabled as WorkVersionCheckName[]) || [];

        // Create check status objects for each enabled check
        const checkStatuses: Record<string, any> = {};
        enabledChecks.forEach((name) => {
          checkStatuses[name] = {};
        });

        // Update metadata with check statuses
        await safeWorkVersionJsonUpdate(workVersionId, (metadata?: Prisma.JsonValue) => {
          const meta = (metadata as Record<string, any>) || { version: 1 };
          return {
            ...meta,
            version: 1,
            checks: {
              enabled: enabledChecks,
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

        // Execute each enabled check via its extension. Each check service is
        // responsible for creating its own checkServiceRun rows and jobs.
        // Require work:checks:dispatch scope before dispatching (same as work-integrity action).
        if (enabledChecks.length > 0) {
          if (!userHasScope(baseCtx.user, scopes.work.checks.dispatch)) {
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
          const checkServices = getExtensionCheckServicesFromServerConfig(
            baseCtx.$config,
            serverExtensions,
          );
          for (const kind of enabledChecks) {
            const service = checkServices.find((s) => s.id === kind);
            if (!service?.handleAction) continue;
            const actionArgs: ExtensionCheckHandleActionArgs = {
              intent: 'execute',
              workVersionId,
              ctx: baseCtx,
              serverExtensions,
            };
            const { success, error, status } = await service.handleAction(actionArgs);
            if (!success || error) {
              return data(
                { error: { type: 'general', message: error?.message ?? 'Check execution failed' } },
                { status: status ?? 500 },
              );
            }
            // Check-start activities are created when jobs are invoked (invoke.server.ts),
            // including for follow-on jobs, so we do not create them here.
          }
        }

        // Redirect to work details unless redirect=false (e.g. when called from manuscript-checks dialog)
        const shouldRedirect = redirectParam !== 'false';
        if (shouldRedirect) {
          return redirect(`/app/works/${workId}/details`);
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
        const work = await findWorkByVersion(workVersionId);
        if (!work) {
          return data(
            { error: { type: 'general', message: 'Work version not found' } },
            { status: 404 },
          );
        }
        const currentMeta = (work.metadata as Record<string, unknown>) ?? {};
        const hasMystFrontmatter =
          currentMeta.myst != null &&
          typeof currentMeta.myst === 'object' &&
          (currentMeta.myst as Record<string, unknown>).frontmatter != null;
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
              const existingMyst = (m.myst as Record<string, unknown>) || {};
              return {
                ...m,
                myst: { ...existingMyst, frontmatter: extracted },
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

function isDocxPath(path: string): boolean {
  return path.toLowerCase().endsWith('.docx');
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
    hasMetadataPreviewScope,
  } = loaderData;
  const previewList: DocxPreviewItem[] = Array.isArray(previews) ? previews : [];
  const revalidator = useRevalidator();
  const fetchPreviewsFetcher = useFetcher();
  const hasTriggeredFetchPreviews = useRef(false);

  // Resolve check services at render time to avoid serialization issues
  // Construct minimal AppConfig from ClientDeploymentConfig
  const deploymentConfig = useDeploymentConfig();
  const checkServices = getExtensionCheckServicesFromClientConfig(deploymentConfig, extensions);

  const files = (metadata?.files ?? {}) as Record<string, { path?: string; name?: string }>;
  const docxFilePaths = Object.entries(files)
    .filter(([, f]) => isDocxPath(f?.path ?? f?.name ?? ''))
    .map(([path]) => path);
  const previewPaths = new Set(previewList.map((p) => p.path));
  const missingPreviewPaths = docxFilePaths.filter((p) => !previewPaths.has(p));
  const shouldFetchPreviews = docxFilePaths.length > 0 && missingPreviewPaths.length > 0;

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
    <MainWrapper>
      <PageFrame
        title={pageTitle}
        subtitle={pageSubtitle}
        hasSecondaryNav={false}
        className="space-y-16 max-w-none text-left"
      >
        <SectionWithHeading
          heading="Upload some files"
          icon={<Upload className="w-5 h-5" />}
          className="space-y-4 max-w-3xl"
        >
          <p className="text-md text-muted-foreground">
            Let's start with your manuscript files and we will see what we can determine from them.
          </p>
          <WorkFileUpload
            cdnKey={cdnKey}
            config={uploadConfig['manuscript']}
            loadedFileMetadata={metadata as any}
          />
        </SectionWithHeading>
        {hasMetadataPreviewScope ? (
          <MetadataPreviewSection
            previewList={previewList}
            isPreviewsLoading={isPreviewsLoading}
            previewOverlayMessage={previewOverlayMessage}
            extractedMetadata={extractedMetadata}
            title={title}
            authors={authors}
          />
        ) : (
          <CaptureMetadataSection title={title} authors={authors} />
        )}
        <SectionWithHeading
          heading="Select Checks to Run"
          icon={<CheckSquare className="w-5 h-5" />}
          className="space-y-4 max-w-3xl"
        >
          <p className="text-muted-foreground">
            Choose which checks you'd like to run on your work.
          </p>
          <ui.Card className="p-6 space-y-4">
            <WorkUploadChecksForm
              enabled={metadata.checks?.enabled || []}
              checkServices={checkServices as ExtensionCheckService[]}
            />
          </ui.Card>
        </SectionWithHeading>
        <ContinueForm title={title} authors={authors} metadata={metadata} />
      </PageFrame>
    </MainWrapper>
  );
}
