import React, { useState } from 'react';
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
import { WorkTitleForm } from './WorkTitleForm';
import { WorkUploadChecksForm } from './WorkUploadChecksForm';
import { ContinueForm } from './ContinueForm';
import { WORK_UPLOAD_CONFIGURATION } from './uploadConfig.server';
import { validateUploadParams } from './validateUpload.server';
import { updateWorkVersionTitle } from './updateMetadata.server';
import { toggleWorkVersionCheck } from './updateChecks.server';
import { handleFetchPreviewsIntent } from './fetchPreviews.server';
import type { ChecksMetadataSection } from './checks.schema';
import { workVersionCheckNameSchema, checksMetadataSchema } from './checks.schema';
import type { WorkVersionCheckName, WorkVersionMetadata } from '@curvenote/scms-server';
import { Await, data, redirect } from 'react-router';
import { Upload, CheckSquare, Eye } from 'lucide-react';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { uuidv7 as uuid } from 'uuidv7';
import { DocxPreviewer } from './DocxPreviewer';

/**
 * Zod schema for work upload form validation
 */
const WorkUploadActionSchema = zfd.formData({
  intent: z.enum(['stage', 'complete', 'remove', 'update-title', 'toggle-check', 'confirm-work']),
  slot: zfd.text(z.string().min(1)).optional(),
  // Optional fields used by specific intents
  completedFiles: zfd.text(z.string()).optional(), // Used by 'complete' intent
  path: zfd.text(z.string()).optional(), // Used by 'remove' intent
  title: zfd.text(z.string().default('')), // Used by 'update-title' intent - allows empty strings
  authors: zfd.text(z.string()).optional(), // Used by 'confirm-work' intent
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

  const userDisplayName =
    ctx.user?.display_name?.trim() || ctx.user?.username?.trim() || ctx.user?.email?.trim() || '';

  // Note: this starts disabled/auto-populated, but we still thread it through
  // to `confirm-work` so the server can persist it onto the work version.
  const authorsText = work.authors?.length ? work.authors.join(', ') : userDisplayName;

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

  // Deferred: DOCX first-page previews (resolved in UI via <Await>)
  const docxPreviewsPromise = handleFetchPreviewsIntent(workVersionId, ctx);

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
    docxPreviewsPromise,
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

  // Handle upload intents (stage, complete, remove, update-title, toggle-check) with validation
  return withValidFormData(
    WorkUploadActionSchema,
    formData,
    async (payload: WorkUploadActionPayload) => {
      const { intent: uploadIntent, slot, title, authors, checkName, checked } = payload;

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

        const userDisplayName =
          baseCtx.user?.display_name?.trim() ||
          baseCtx.user?.username?.trim() ||
          baseCtx.user?.email?.trim() ||
          '';

        const authorsText = (authors ?? '').trim() || userDisplayName;
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

        // Navigate to work details page
        return redirect(`/app/works/${workId}/details`);
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
  const { cdnKey, uploadConfig, metadata, title, authors, pageTitle, pageSubtitle } = loaderData;
  const [authorsText, setAuthorsText] = useState(authors ?? '');

  // Resolve check services at render time to avoid serialization issues
  // Construct minimal AppConfig from ClientDeploymentConfig
  const deploymentConfig = useDeploymentConfig();
  const checkServices = getExtensionCheckServicesFromClientConfig(deploymentConfig, extensions);

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
        <SectionWithHeading
          heading="Metadata Preview"
          icon={<Eye className="w-5 h-5" />}
          className="space-y-4"
        >
          <p className="text-muted-foreground">Review your document metadata</p>
          <React.Suspense
            fallback={<p className="text-sm text-muted-foreground">Loading DOCX previews…</p>}
          >
            <Await
              resolve={loaderData.docxPreviewsPromise}
              errorElement={
                <p className="text-sm text-destructive">Failed to load DOCX previews.</p>
              }
            >
              {(resolved) => {
                const hasPreviews = resolved.previews.length > 0;
                const layoutClass = hasPreviews
                  ? 'grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr] lg:items-stretch'
                  : 'flex gap-6 max-w-5xl';
                const previewCardClass = hasPreviews
                  ? 'overflow-hidden p-0 min-h-0 flex flex-col'
                  : 'overflow-hidden p-0 min-h-0 flex flex-col max-w-xl';
                return (
                  <div className={layoutClass}>
                    <ui.Card className={previewCardClass}>
                      <div className="min-h-[200px] flex-1 flex flex-col p-4">
                        <DocxPreviewer previews={resolved.previews} />
                      </div>
                    </ui.Card>
                    <ui.Card className="px-6 pt-4 pb-6 space-y-4 h-fit min-w-lg">
                      <WorkTitleForm title={title} />
                      <div className="space-y-1">
                        <label htmlFor="authors" className="inline-block text-sm font-medium">
                          Authors
                        </label>
                        <ui.Textarea
                          id="authors"
                          value={authorsText}
                          onChange={(e) => setAuthorsText(e.target.value)}
                          placeholder="Enter author names, comma-separated"
                          rows={3}
                        />
                      </div>
                    </ui.Card>
                  </div>
                );
              }}
            </Await>
          </React.Suspense>
        </SectionWithHeading>
        <SectionWithHeading
          heading="Select Checks to Run"
          icon={<CheckSquare className="w-5 h-5" />}
          className="space-y-4"
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
        <ContinueForm title={title} authors={authorsText} metadata={metadata} />
      </PageFrame>
    </MainWrapper>
  );
}
