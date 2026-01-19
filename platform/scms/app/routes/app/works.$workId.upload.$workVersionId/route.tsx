import type { Route } from './+types/route';
import {
  withAppScopedContext,
  findWorkByVersion,
  workVersionUploadsStage,
  workVersionUploadsComplete,
  workVersionUploadRemove,
  WorkContext,
  withValidFormData,
  getPrismaClient,
  safeWorkVersionJsonUpdate,
} from '@curvenote/scms-server';
import type { Prisma } from '@curvenote/scms-db';
import type { ExtensionCheckService, FileMetadataSection } from '@curvenote/scms-core';
import {
  MainWrapper,
  PageFrame,
  SectionWithHeading,
  WorkFileUpload,
  TrackEvent,
  ui,
  FileMetadataSectionSchema,
  scopes,
  getExtensionCheckServices,
  useDeploymentConfig,
} from '@curvenote/scms-core';
import { extensions } from '../../../extensions/client';
import { WorkTitleForm } from './WorkTitleForm';
import { WorkUploadChecksForm } from './WorkUploadChecksForm';
import { ContinueForm } from './ContinueForm';
import { WORK_UPLOAD_CONFIGURATION } from './uploadConfig.server';
import { validateUploadParams } from './validateUpload.server';
import { updateWorkVersionTitle } from './updateMetadata.server';
import { toggleWorkVersionCheck } from './updateChecks.server';
import type { ChecksMetadataSection } from './checks.schema';
import { workVersionCheckNameSchema, checksMetadataSchema } from './checks.schema';
import type { WorkVersionCheckName, WorkVersionMetadata } from '@curvenote/scms-server';
import { data, redirect } from 'react-router';
import { List, Upload, CheckSquare } from 'lucide-react';
import { z } from 'zod';
import { zfd } from 'zod-form-data';

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
  checkName: zfd.text(workVersionCheckNameSchema).optional(), // Used by 'toggle-check' intent
  checked: zfd.text(z.enum(['true', 'false'])).optional(), // Used by 'toggle-check' intent
});

type WorkUploadActionPayload = z.infer<typeof WorkUploadActionSchema>;

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

  return {
    workVersionId: work.version_id,
    cdnKey: work.cdn_key!,
    cdn: work.cdn!,
    title: work.title,
    metadata,
    uploadConfig: WORK_UPLOAD_CONFIGURATION,
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
      const { intent: uploadIntent, slot, title, checkName, checked } = payload;

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

        // Get current metadata to access enabled checks
        const work = await prisma.workVersion.findUnique({
          where: { id: workVersionId },
          select: { metadata: true },
        });

        const currentMetadata = (work?.metadata as any) || { version: 1 };
        const enabledChecks = (currentMetadata.checks?.enabled as WorkVersionCheckName[]) || [];

        // Create check status objects for each enabled check
        const checkStatuses: Record<string, { dispatched: boolean }> = {};
        enabledChecks.forEach((name) => {
          checkStatuses[name] = { dispatched: false };
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
        await prisma.workVersion.update({
          where: { id: workVersionId },
          data: {
            draft: false,
            date_modified: new Date().toISOString(),
          },
        });

        // Navigate to checks page
        return redirect(`/app/works/${workId}/checks`);
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
  const { cdnKey, uploadConfig, metadata, title } = loaderData;

  // Resolve check services at render time to avoid serialization issues
  // Construct minimal AppConfig from ClientDeploymentConfig
  const deploymentConfig = useDeploymentConfig();
  const extensionsConfig: Record<string, { checks?: boolean }> = {};
  if (deploymentConfig.extensions) {
    for (const [extId, extInfo] of Object.entries(deploymentConfig.extensions)) {
      // If 'checks' is in capabilities, enable it
      if (extInfo.capabilities.includes('checks')) {
        extensionsConfig[extId] = { checks: true };
      }
    }
  }
  const checkServices = getExtensionCheckServices(
    { app: { extensions: extensionsConfig } } as unknown as AppConfig,
    extensions,
  );

  return (
    <MainWrapper>
      <PageFrame
        title="Upload a New Work"
        subtitle="Start a new work by uploading your files"
        hasSecondaryNav={false}
        className="mx-auto space-y-16 max-w-3xl"
      >
        <SectionWithHeading
          heading="Upload some files"
          icon={<Upload className="w-5 h-5" />}
          className="space-y-4"
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
          heading="Capture Your Metadata"
          icon={<List className="w-5 h-5" />}
          className="space-y-4"
        >
          <p className="text-muted-foreground">
            We'll need the following metadata about your work, we've tried to guess some of it for
            you but please check and adjust as needed.
          </p>
          <ui.Card className="px-6 pt-4 pb-6 space-y-4">
            <WorkTitleForm title={title} />
          </ui.Card>
        </SectionWithHeading>
        <SectionWithHeading
          heading="Select Checks to Run"
          icon={<CheckSquare className="w-5 h-5" />}
          className="space-y-4"
        >
          <p className="text-muted-foreground">
            Choose which integrity checks you'd like to run on your work.
          </p>
          <ui.Card className="p-6 space-y-4">
            <WorkUploadChecksForm
              enabled={metadata.checks?.enabled || []}
              checkServices={checkServices as ExtensionCheckService[]}
            />
          </ui.Card>
        </SectionWithHeading>
        <ContinueForm title={title} metadata={metadata} />
      </PageFrame>
    </MainWrapper>
  );
}
