import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Route } from './+types/route';
import type {
  WorkVersionCheckName,
  WorkVersionMetadata,
  ChecksMetadataSection,
} from '@curvenote/scms-server';
import {
  withAppScopedContext,
  userHasScope,
  userHasWorkScope,
  dbGetUserWorkRoles,
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
  fetchOrcidPerson,
  searchOrcid,
  searchOrcidById,
  searchRor,
  File,
  StorageBackend,
  KnownBuckets,
  resolveThumbnailBucket,
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
  resolveUploadCheckLogoUrls,
  CheckMaintenanceProvider,
  capitalize,
  scopes,
  isValidOrcid,
  computeManuscriptSourceSignature,
  UPLOAD_ANALYSIS_METADATA_KEY,
  uploadFactPresenceFromValue,
  clearUploadAnalysisMetadataFacts,
} from '@curvenote/scms-core';
import { extensions } from '../../../extensions/client';
import { extensions as serverExtensions } from '../../../extensions/server';
import { WorkUploadChecksForm } from './WorkUploadChecksForm';
import { ContinueForm } from './ContinueForm';
import { WORK_UPLOAD_CONFIGURATION } from './uploadConfig.server';
import { validateUploadParams } from './validateUpload.server';
import {
  updateWorkVersionTitle,
  updateWorkVersionAuthors,
  updateWorkVersionAuthorMetadata,
} from './updateMetadata.server';
import { toggleWorkVersionCheck } from './updateChecks.server';
import { shouldTrackWorkViewedOnLoader } from './loaderAnalytics.server.js';
import { data, redirect, useFetcher, useParams, useRevalidator } from 'react-router';
import {
  handleFetchPreviewsIntent,
  deletePreviewArtifactsForVersion,
  persistThumbnailListingForVersion,
  signPreviewFigures,
} from './metadata-extract/fetchPreviews.server';
import {
  readDocumentPreviewsFromObjectTable,
  type DocumentPreviewItem,
} from './metadata-extract/fetchPreviews.server';
import { extractMetadataFromPreviews } from './metadata-extract/anthropic.server';
import type { ExtractedMetadata } from './metadata-extract/anthropic.server';
import { Upload, CheckSquare } from 'lucide-react';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { MetadataExtractSection } from './metadata-extract/MetadataExtractSection';
import { PREVIEW_BUSY_MESSAGES } from './metadata-extract/busyMessages';
import { useRotatingMessage } from './metadata-extract/useRotatingMessage';
import { ChooseThumbnailSection } from './metadata-extract/ChooseThumbnailSection';
import { collectAllFigures } from './metadata-extract/DocumentPreviewer';
import { materializeSelectedThumbnail } from './metadata-extract/materializeThumbnail.server';
import {
  encodeFigureLocator,
  resolveThumbnailSelection,
} from './metadata-extract/thumbnailSelection';
import { CaptureMetadataSection } from './CaptureMetadataSection';
import { isPreviewCandidate } from './metadata-extract/previewGuards';
import type { AuthorFieldMetadata } from './mystAuthorAdapters';
import { mystFrontmatterToAuthorField } from './mystAuthorAdapters';
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
    'update-author-metadata',
    'search-orcid',
    'search-orcid-by-id',
    'fetch-orcid',
    'search-ror',
    'toggle-check',
    'confirm-work',
    'fetch-previews',
    'extract-metadata',
    'clear-extracted-metadata',
  ]),
  slot: zfd.text(z.string().min(1)).optional(),
  // Optional fields used by specific intents
  completedFiles: zfd.text(z.string()).optional(), // Used by 'complete' intent
  path: zfd.text(z.string()).optional(), // Used by 'remove' and 'extract-metadata' (target file) intents
  force: zfd.text(z.enum(['true', 'false'])).optional(), // Used by 'extract-metadata' to bypass the cache
  title: zfd.text(z.string().default('')), // Used by 'update-title' intent - allows empty strings
  authors: zfd.text(z.string()).optional(), // Used by 'confirm-work' intent
  authorMetadata: zfd.text(z.string()).optional(), // Used by 'update-author-metadata' intent
  q: zfd.text(z.string()).optional(), // Used by search intents
  orcid: zfd.text(z.string()).optional(), // Used by ORCID lookup intents
  thumbnail: zfd.text(z.string()).optional(), // Used by 'confirm-work' intent - selected thumbnail locator
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

function parseAuthorFieldMetadata(raw: string | undefined): AuthorFieldMetadata | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthorFieldMetadata>;
    return {
      authors: Array.isArray(parsed.authors) ? parsed.authors : [],
      affiliations: Array.isArray(parsed.affiliations) ? parsed.affiliations : [],
    };
  } catch {
    return null;
  }
}

/** Metadata key holding the source signature of the cached `frontmatter.myst` extraction. */
const METADATA_EXTRACT_SOURCE_KEY = 'frontmatter.myst.source';

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
      // Check-start activities are created at job enqueue/run time, so we do not create them here.
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
          title: 'Review and Update',
          subtitle: `Review inherited files and metadata, then update this ${workLabel} version as needed`,
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

  // Read only cached document previews from Object table (no generation in loader),
  // then attach signed URLs to candidate figures so the picker never ships base64.
  const cachedPreviews = await readDocumentPreviewsFromObjectTable(workVersionId, signedMetadata);
  const previews = await signPreviewFigures(cachedPreviews, work.cdn ?? '', ctx);
  // Stored under the same key as the ETL register-work endpoint: metadata["frontmatter.myst"].
  const mystFrontmatter = (rawMetadata as Record<string, unknown>)?.['frontmatter.myst'];
  const extractedMetadata: ExtractedMetadata | null =
    mystFrontmatter != null &&
    typeof mystFrontmatter === 'object' &&
    !Array.isArray(mystFrontmatter)
      ? (mystFrontmatter as ExtractedMetadata)
      : null;
  const authorFieldMetadata = mystFrontmatterToAuthorField(extractedMetadata, work.authors ?? []);

  let inheritedThumbnail: { key: string; signedUrl: string } | undefined;
  const inheritedThumbnailKey =
    typeof work.thumbnail === 'string' && work.thumbnail.trim() ? work.thumbnail.trim() : null;
  if (inheritedThumbnailKey && work.cdn) {
    try {
      const backend = new StorageBackend(ctx, [KnownBuckets.prv, KnownBuckets.pub]);
      const bucket = resolveThumbnailBucket(ctx, backend, work.cdn);
      const signedUrl = await new File(backend, inheritedThumbnailKey, bucket).url();
      inheritedThumbnail = { key: inheritedThumbnailKey, signedUrl };
    } catch (err) {
      console.warn('[work-upload] failed to sign inherited thumbnail', inheritedThumbnailKey, err);
    }
  }

  const hasMetadataExtractScope = userHasScope(
    ctx.user,
    scopes.app.works.metadataExtract,
    undefined,
    { ignoreSystemAdmin: true },
  );

  const uploadCheckLogoUrls = await resolveUploadCheckLogoUrls(ctx, ctx.$config, serverExtensions);

  const uploadCheckServices = getExtensionCheckServicesFromServerConfig(
    ctx.$config,
    serverExtensions,
  );
  const maintenanceByServiceId = await loadCheckMaintenanceByServiceIds(
    ctx,
    serverExtensions,
    uploadCheckServices.map((service) => service.id),
  );

  const workRoles = await dbGetUserWorkRoles(ctx.user.id, workId);
  const userWithWorkRoles = { ...ctx.user, work_roles: workRoles };
  const hasChecksFeature = userHasScope(ctx.user, scopes.app.works.checks.feature);
  const canDispatchChecks = userHasWorkScope(
    userWithWorkRoles,
    scopes.work.id.checks.dispatch,
    workId,
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
    authorFieldMetadata,
    inheritedThumbnail,
    hasMetadataExtractScope,
    hasChecksFeature,
    canDispatchChecks,
    uploadCheckLogoUrls,
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

  const workRoles = await dbGetUserWorkRoles(baseCtx.user.id, workId);
  const userWithWorkRoles = { ...baseCtx.user, work_roles: workRoles };

  const rejectCheckDispatch = () =>
    data(
      {
        error: {
          type: 'general',
          message: 'You do not have permission to dispatch checks for this work',
        },
      },
      { status: 403 },
    );

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
        authorMetadata,
        thumbnail: thumbnailLocator,
        redirect: redirectParam,
        checkName,
        checked,
        path: targetPath,
        force,
        q,
        orcid,
      } = payload;

      if (uploadIntent === 'fetch-orcid') {
        const orcidValue = (orcid ?? '').trim();
        if (!isValidOrcid(orcidValue)) {
          return data(
            { error: { type: 'general', message: 'Invalid ORCID format.' } },
            { status: 400 },
          );
        }
        const person = await fetchOrcidPerson(orcidValue);
        if (!person) {
          return data(
            {
              error: {
                type: 'general',
                message: 'Could not find this ORCID or fetch public record.',
              },
            },
            { status: 404 },
          );
        }
        return data({
          name: person.name,
          orcid: person.orcid,
          ...(person.email && { email: person.email }),
          affiliations: person.affiliations ?? [],
        });
      }

      if (uploadIntent === 'search-orcid') {
        return data({ results: await searchOrcid((q ?? '').trim()) });
      }

      if (uploadIntent === 'search-orcid-by-id') {
        const orcidValue = (orcid ?? '').trim();
        if (!isValidOrcid(orcidValue)) {
          return data(
            { error: { type: 'general', message: 'Invalid ORCID format.' } },
            { status: 400 },
          );
        }
        return data({ results: await searchOrcidById(orcidValue) });
      }

      if (uploadIntent === 'search-ror') {
        return data({ results: await searchRor((q ?? '').trim()) });
      }

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

      if (uploadIntent === 'update-author-metadata') {
        if (!workVersionId) {
          return data(
            { error: { type: 'general', message: 'Work version ID is required' } },
            { status: 400 },
          );
        }
        const parsed = parseAuthorFieldMetadata(authorMetadata);
        if (!parsed) {
          return data(
            { error: { type: 'general', message: 'Invalid author metadata payload' } },
            { status: 400 },
          );
        }
        return updateWorkVersionAuthorMetadata(workVersionId, parsed);
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

        if (!userHasWorkScope(userWithWorkRoles, scopes.work.id.checks.dispatch, workId)) {
          return rejectCheckDispatch();
        }

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

        const submittedAuthorMetadata = parseAuthorFieldMetadata(authorMetadata);
        if (authorMetadata && !submittedAuthorMetadata) {
          return data(
            { error: { type: 'general', message: 'Invalid author metadata payload' } },
            { status: 400 },
          );
        }
        const authorsText = !submittedAuthorMetadata ? (authors ?? '').trim() : '';
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

        // Require dispatch permission before any confirm-work mutations. Otherwise
        // a failed dispatch gate could still leave the work version confirmed.
        if (
          dispatchableChecks.length > 0 &&
          !userHasWorkScope(userWithWorkRoles, scopes.work.id.checks.dispatch, workId)
        ) {
          return rejectCheckDispatch();
        }

        if (submittedAuthorMetadata) {
          const result = await updateWorkVersionAuthorMetadata(
            workVersionId,
            submittedAuthorMetadata,
          );
          if (!('success' in result)) return result;
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

        // Materialise the selected thumbnail (best-effort: never blocks submission).
        // The locator is the candidate figure's storage key; materialisation validates
        // it and we point the thumbnail column straight at that already-stored webp.
        let materializedThumbnailKey: string | null = null;
        if (thumbnailLocator && wv.cdn) {
          try {
            materializedThumbnailKey = await materializeSelectedThumbnail({
              ctx: baseCtx,
              workVersionId,
              cdn: wv.cdn,
              locator: thumbnailLocator,
            });
            if (materializedThumbnailKey) {
              await prisma.workVersion.update({
                where: { id: workVersionId },
                data: { thumbnail: materializedThumbnailKey },
              });
            }
          } catch (error) {
            console.error('[work-upload] thumbnail materialization failed', {
              workId,
              workVersionId,
              error,
            });
          }
        }

        // Finalise preview artifacts now that they have served their purpose: first record
        // every generated thumbnail under metadata.thumbnails (the durable listing — the
        // thumbnail files themselves are retained in storage), then drop the regenerable
        // cached preview rows. Order matters: the listing is collected from those rows
        // before they are deleted. Runs after the response so it never delays submission;
        // best-effort and self-regenerating.
        waitUntil(
          persistThumbnailListingForVersion(workVersionId)
            .then(() => deletePreviewArtifactsForVersion(workVersionId))
            .catch((error) => {
              console.warn('[work-upload] preview artifact finalisation failed', {
                workId,
                workVersionId,
                error,
              });
            }),
        );

        // Schedule each enabled check via its extension. Each check service is
        // responsible for creating its own checkServiceRun rows and jobs.
        if (dispatchableChecks.length > 0) {
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

      // Fetch document previews (generate + write to Object table only)
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

      if (uploadIntent === 'clear-extracted-metadata') {
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
                message: 'You do not have permission to clear extracted metadata',
              },
            },
            { status: 403 },
          );
        }
        await safeWorkVersionJsonUpdate(workVersionId, (current?: Prisma.JsonValue) => {
          const meta = (current as Record<string, unknown>) || {};
          const next = { ...meta };
          delete next['frontmatter.myst'];
          delete next[METADATA_EXTRACT_SOURCE_KEY];
          return clearUploadAnalysisMetadataFacts(next) as Prisma.JsonObject;
        });
        const prisma = await getPrismaClient();
        await prisma.workVersion.update({
          where: { id: workVersionId },
          data: {
            title: '',
            authors: [],
            author_details: [],
            date_modified: new Date().toISOString(),
          },
          select: { id: true },
        });
        return data({ ok: true });
      }

      // Extract metadata from first document preview via Claude (only when no frontmatter and we have previews)
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
        const currentSourceSignature = computeManuscriptSourceSignature(currentMeta);
        const cachedSourceSignature = currentMeta[METADATA_EXTRACT_SOURCE_KEY];
        // `force` is set by the manual "re-run extraction" control and always
        // re-extracts. Otherwise skip when a cached result exists with no source
        // marker (legacy/ETL metadata), or when the marker matches the current
        // manuscript file(s); a changed/replaced document invalidates the cache.
        const forceReextract = force === 'true';
        const hasCachedSourceSignature =
          typeof cachedSourceSignature === 'string' && cachedSourceSignature !== '';
        if (
          !forceReextract &&
          hasMystFrontmatter &&
          (!hasCachedSourceSignature || cachedSourceSignature === currentSourceSignature)
        ) {
          return data({ ok: true });
        }
        const signedMetadata = await signFilesInMetadata(
          (work.metadata as Parameters<typeof signFilesInMetadata>[0]) ?? {},
          work.cdn ?? '',
          baseCtx,
        );
        const previews = await readDocumentPreviewsFromObjectTable(workVersionId, signedMetadata);
        if (previews.length === 0) {
          return data({ ok: true });
        }
        try {
          const extracted = await extractMetadataFromPreviews({ previews }, baseCtx, targetPath);
          if (extracted != null) {
            await safeWorkVersionJsonUpdate(workVersionId, (current?: Prisma.JsonValue) => {
              const m = (current as Record<string, unknown>) || {};
              const existingAnalysis = m[UPLOAD_ANALYSIS_METADATA_KEY];
              const baseAnalysis =
                existingAnalysis &&
                typeof existingAnalysis === 'object' &&
                !Array.isArray(existingAnalysis) &&
                (existingAnalysis as { sourceSignature?: unknown }).sourceSignature ===
                  currentSourceSignature
                  ? (existingAnalysis as Record<string, unknown>)
                  : {};
              // Align with the ETL register-work endpoint: store at metadata["frontmatter.myst"].
              // Record the source signature so we can detect when this cache goes stale.
              return {
                ...m,
                'frontmatter.myst': extracted,
                [METADATA_EXTRACT_SOURCE_KEY]: currentSourceSignature,
                [UPLOAD_ANALYSIS_METADATA_KEY]: {
                  ...baseAnalysis,
                  source: 'metadata-preview',
                  sourceSignature: currentSourceSignature,
                  metadata: {
                    ...((baseAnalysis.metadata as Record<string, unknown> | undefined) ?? {}),
                    title: uploadFactPresenceFromValue(extracted.title),
                    authors: uploadFactPresenceFromValue(extracted.authors),
                    affiliations: uploadFactPresenceFromValue(extracted.affiliations),
                  },
                },
              } as Prisma.JsonObject;
            });

            // Seed the work version title/authors from the extracted metadata. On an
            // automatic extraction we only fill empty fields (so we never clobber an
            // author's edits, and the Continue button gets a title). A manual re-run
            // is an explicit request to refresh, so it overwrites title/authors.
            const extractedTitle = extracted.title?.trim() ?? '';
            if (extractedTitle && (forceReextract || !work.title?.trim())) {
              await updateWorkVersionTitle(workVersionId, extractedTitle);
            }
            const extractedAuthorMetadata = mystFrontmatterToAuthorField(extracted);
            if (
              extractedAuthorMetadata.authors.length > 0 &&
              (forceReextract || !work.authors?.length)
            ) {
              await updateWorkVersionAuthorMetadata(workVersionId, extractedAuthorMetadata);
            }
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
    pageTitle,
    pageSubtitle,
    previews = [],
    extractedMetadata,
    authorFieldMetadata,
    inheritedThumbnail,
    maintenanceByServiceId,
    hasMetadataExtractScope,
    hasChecksFeature,
    canDispatchChecks,
  } = loaderData;
  const { workVersionId } = useParams();
  const rawPreviews: DocumentPreviewItem[] = Array.isArray(previews) ? previews : [];
  const [selectedThumbnail, setSelectedThumbnail] = useState<string | null>(() =>
    inheritedThumbnail?.key ? encodeFigureLocator(inheritedThumbnail.key) : null,
  );
  const [authorMetadata, setAuthorMetadata] = useState<AuthorFieldMetadata>(authorFieldMetadata);
  const revalidator = useRevalidator();
  const fetchPreviewsFetcher = useFetcher();
  const autoTitleFromFilenameFetcher = useFetcher();
  const hasTriggeredFetchPreviews = useRef(false);
  // Tracks preview paths we've already observed, so a background preview that
  // resolves after its file was removed only raises its toast once.
  const seenPreviewPathsRef = useRef<Set<string> | null>(null);

  const suggestArticleTitleFromSelectedFiles = useCallback(
    (files: File[]) => {
      // When the metadata-extract feature is enabled the title is sourced from
      // the extracted document metadata, so don't fall back to the file name.
      if (hasMetadataExtractScope) return;

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
    [title, extractedMetadata, hasMetadataExtractScope, autoTitleFromFilenameFetcher.submit],
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
  const previewFilePaths = Object.entries(files)
    .filter(([, f]) => isPreviewCandidate(f))
    .map(([path]) => path);
  // A preview generated in the background can resolve after its source file was
  // removed or replaced in the upload area. Only surface previews whose file is
  // still in the current upload list so stale results are never shown.
  const previewFilePathSet = new Set(previewFilePaths);
  const previewList = rawPreviews.filter((p) => previewFilePathSet.has(p.path));
  const previewPaths = new Set(previewList.map((p) => p.path));
  const missingPreviewPaths = previewFilePaths.filter((p) => !previewPaths.has(p));
  const shouldFetchPreviews =
    hasMetadataExtractScope && previewFilePaths.length > 0 && missingPreviewPaths.length > 0;

  // When a background preview finishes after its file was removed from the dropzone,
  // tell the user it was cached for a future upload of the same file.
  useEffect(() => {
    if (!hasMetadataExtractScope) return;

    const currentUploadPaths = new Set(previewFilePaths);
    const seen = seenPreviewPathsRef.current;
    if (seen === null) {
      seenPreviewPathsRef.current = new Set(rawPreviews.map((p) => p.path));
      return;
    }

    for (const preview of rawPreviews) {
      if (seen.has(preview.path)) continue;
      seen.add(preview.path);

      if (currentUploadPaths.has(preview.path)) continue;

      const fileName = preview.data?.name?.trim() || preview.path;
      ui.toastInfo(
        `The preview of ${fileName} completed in the background and was cached for next time you upload this file.`,
      );
    }
  }, [hasMetadataExtractScope, rawPreviews, previewFilePaths]);

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

  // Re-kick preview generation after the user retries a skipped preview. The
  // auto-fetch effect above will not fire again on its own once it has run, so
  // resubmit here (only when idle) to restart the generation + busy state.
  const handleRetryPreview = useCallback(() => {
    if (fetchPreviewsFetcher.state !== 'idle') return;
    hasTriggeredFetchPreviews.current = true;
    fetchPreviewsFetcher.submit({ intent: 'fetch-previews' }, { method: 'POST' });
  }, [fetchPreviewsFetcher]);

  const isGeneratingPreviews =
    fetchPreviewsFetcher.state === 'loading' || fetchPreviewsFetcher.state === 'submitting';
  const isPreviewsLoading = revalidator.state === 'loading' || isGeneratingPreviews;
  const rotatingPreviewMessage = useRotatingMessage(PREVIEW_BUSY_MESSAGES, isGeneratingPreviews);
  const previewOverlayMessage = isGeneratingPreviews
    ? rotatingPreviewMessage
    : 'Refreshing previews…';
  const previewError = fetchPreviewsFetcher.data?.error?.message ?? null;
  const thumbnailLocators = useMemo(
    () => collectAllFigures(previewList).map(({ figure }) => encodeFigureLocator(figure.key)),
    [previewList],
  );
  const effectiveSelectedThumbnail = useMemo(
    () => resolveThumbnailSelection(thumbnailLocators, selectedThumbnail),
    [thumbnailLocators, selectedThumbnail],
  );

  useEffect(() => {
    setAuthorMetadata(authorFieldMetadata);
  }, [authorFieldMetadata]);

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
              fallback={<p className="text-sm text-muted-foreground">Loading document previews…</p>}
            >
              <MetadataExtractSection
                previewList={previewList}
                isPreviewsLoading={isPreviewsLoading}
                previewOverlayMessage={previewOverlayMessage}
                previewError={previewError}
                extractedMetadata={extractedMetadata}
                title={title}
                authorMetadata={authorMetadata}
                onAuthorMetadataChange={setAuthorMetadata}
                previewCandidateFileCount={previewFilePaths.length}
                onRetryPreview={handleRetryPreview}
              />
            </React.Suspense>
          ) : (
            <CaptureMetadataSection
              title={title}
              authorMetadata={authorMetadata}
              onAuthorMetadataChange={setAuthorMetadata}
            />
          )}
          {hasMetadataExtractScope ? (
            <ChooseThumbnailSection
              previewList={previewList}
              value={effectiveSelectedThumbnail}
              onChange={setSelectedThumbnail}
              pinnedThumbnail={inheritedThumbnail ?? null}
            />
          ) : null}
          {hasChecksFeature && canDispatchChecks ? (
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
                uploadCheckLogoUrls={loaderData.uploadCheckLogoUrls}
              />
            </SectionWithHeading>
          ) : null}
          <ContinueForm
            title={title}
            authorMetadata={authorMetadata}
            metadata={metadata}
            checkServices={checkServices}
            selectedThumbnail={effectiveSelectedThumbnail}
          />
        </PageFrame>
      </MainWrapper>
    </CheckMaintenanceProvider>
  );
}
